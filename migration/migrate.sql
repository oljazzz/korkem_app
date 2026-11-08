-- migrate.sh шақырады; ағымдағы папкада CSV файлдар болуы керек.
BEGIN;

CREATE TEMP TABLE l_category (id uuid, name text, sort_order int, deleted boolean) ON COMMIT DROP;
CREATE TEMP TABLE l_product  (id uuid, category_id uuid, name text, price numeric, sort_order int, deleted boolean) ON COMMIT DROP;
CREATE TEMP TABLE l_client   (id uuid, name text, address text, deleted boolean) ON COMMIT DROP;
CREATE TEMP TABLE l_invoice  (id uuid, number bigint, client_id uuid, created_date timestamp, created_by text) ON COMMIT DROP;
CREATE TEMP TABLE l_item     (id uuid, invoice_id uuid, product_id uuid, category_id uuid, unit text, price numeric,
                              quantity numeric, discount numeric, total numeric, vat numeric, sort_order int,
                              created_date timestamp) ON COMMIT DROP;
\copy l_category FROM 'category.csv' csv
\copy l_product  FROM 'product.csv' csv
\copy l_client   FROM 'client.csv' csv
\copy l_invoice  FROM 'invoice.csv' csv
\copy l_item     FROM 'item.csv' csv

-- Ескі UUID -> жаңа сандық ID
CREATE TEMP TABLE m_category ON COMMIT DROP AS
  SELECT id AS old, row_number() OVER (ORDER BY sort_order NULLS LAST, name, id) AS new
  FROM l_category WHERE NOT deleted;
CREATE TEMP TABLE m_product ON COMMIT DROP AS
  SELECT id AS old, row_number() OVER (ORDER BY name, id) AS new
  FROM l_product WHERE NOT deleted;
-- Тірі клиенттер + жойылған, бірақ накладнойда қолданылатын клиенттер
CREATE TEMP TABLE m_client ON COMMIT DROP AS
  SELECT id AS old, row_number() OVER (ORDER BY name, id) AS new
  FROM l_client c
  WHERE NOT deleted OR EXISTS (SELECT 1 FROM l_invoice i WHERE i.client_id = c.id);
CREATE TEMP TABLE m_invoice ON COMMIT DROP AS
  SELECT id AS old, row_number() OVER (ORDER BY number, id) AS new FROM l_invoice;

TRUNCATE invoice_line, invoice, product, category, client RESTART IDENTITY CASCADE;

INSERT INTO category (id, name, sort_order)
SELECT m.new, trim(c.name), c.sort_order FROM l_category c JOIN m_category m ON m.old = c.id;

INSERT INTO product (id, category_id, name, price, sort_order)
SELECT m.new, mc.new, trim(p.name), round(coalesce(p.price, 0), 2), p.sort_order
FROM l_product p JOIN m_product m ON m.old = p.id
LEFT JOIN m_category mc ON mc.old = p.category_id;

INSERT INTO client (id, name, address)
SELECT m.new, trim(c.name), nullif(trim(c.address), '') FROM l_client c JOIN m_client m ON m.old = c.id;

INSERT INTO invoice (id, number, client_id, created_at, created_by)
SELECT m.new, i.number, mc.new, i.created_date AT TIME ZONE 'UTC', i.created_by
FROM l_invoice i JOIN m_invoice m ON m.old = i.id
LEFT JOIN m_client mc ON mc.old = i.client_id;

-- Ескі «Цена» скидка шегерілген баға (сомма = баға × саны).
-- Жаңа жүйе Сомма = Баға × Саны × (1 − Скидка/100) деп есептейді, сондықтан скидкаға дейінгі бағаны сақтаймыз.
-- Ескі сомма мен НДС өзгеріссіз көшіріледі.
INSERT INTO invoice_line (invoice_id, category_id, product_id, product_name, unit, price, quantity, discount,
                          total, vat, sort_order)
SELECT mi.new, mc.new, mp.new,
       coalesce(trim(p.name), '—'),
       'SHT',
       CASE WHEN coalesce(it.discount, 0) > 0 AND it.discount < 100
            THEN round(f.price / (1 - it.discount / 100), 2)
            ELSE round(f.price, 2) END,
       f.qty,
       nullif(it.discount, 0),
       round(f.total, 2),
       round(coalesce(it.vat, f.total * 12 / 112), 2),
       it.sort_order
FROM l_item it
-- Ескі базада бірнеше толық емес жол бар: баға жоқ болса — прайс-лист бағасы, саны жоқ болса — 0
CROSS JOIN LATERAL (
  SELECT coalesce(it.price, (SELECT price FROM l_product WHERE id = it.product_id), 0) AS price,
         coalesce(it.quantity, 0) AS qty
) b
CROSS JOIN LATERAL (
  SELECT b.price, b.qty, coalesce(it.total, b.price * b.qty) AS total
) f
JOIN m_invoice mi ON mi.old = it.invoice_id
LEFT JOIN l_product p ON p.id = it.product_id
LEFT JOIN m_product mp ON mp.old = it.product_id
LEFT JOIN m_category mc ON mc.old = it.category_id
ORDER BY mi.new, it.sort_order NULLS LAST, it.created_date, it.id;

SELECT setval(pg_get_serial_sequence('category', 'id'), GREATEST((SELECT max(id) FROM category), 1));
SELECT setval(pg_get_serial_sequence('product', 'id'), GREATEST((SELECT max(id) FROM product), 1));
SELECT setval(pg_get_serial_sequence('client', 'id'), GREATEST((SELECT max(id) FROM client), 1));
SELECT setval(pg_get_serial_sequence('invoice', 'id'), GREATEST((SELECT max(id) FROM invoice), 1));
SELECT setval(pg_get_serial_sequence('invoice_line', 'id'), GREATEST((SELECT max(id) FROM invoice_line), 1));
SELECT setval('invoice_number_seq', GREATEST((SELECT max(number) FROM invoice), 1));

\echo 'Ескі базада:'
SELECT (SELECT count(*) FROM l_category WHERE NOT deleted) AS categories,
       (SELECT count(*) FROM l_product WHERE NOT deleted) AS products,
       (SELECT count(*) FROM m_client) AS clients,
       (SELECT count(*) FROM l_invoice) AS invoices,
       (SELECT count(*) FROM l_item it WHERE EXISTS (SELECT 1 FROM l_invoice i WHERE i.id = it.invoice_id)) AS lines,
       (SELECT round(sum(total), 2) FROM l_item it WHERE EXISTS (SELECT 1 FROM l_invoice i WHERE i.id = it.invoice_id)) AS total_sum;
\echo 'Жаңа базада:'
SELECT (SELECT count(*) FROM category) AS categories, (SELECT count(*) FROM product) AS products,
       (SELECT count(*) FROM client) AS clients, (SELECT count(*) FROM invoice) AS invoices,
       (SELECT count(*) FROM invoice_line) AS lines, (SELECT sum(total) FROM invoice_line) AS total_sum;

COMMIT;
