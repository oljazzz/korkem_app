#!/usr/bin/env bash
# Ескі Jmix базасынан (OLD_DB) жаңа базаға (NEW_DB) деректерді көшіреді.
# Жаңа базадағы категория/тауар/клиент/накладной кестелері ТАЗАЛАНАДЫ, пайдаланушыларға тиіспейді.
#
#   OLD_DB=korkem_old NEW_DB=korkem_invoice ./migration/migrate.sh
#
# Ескі базаны алу: pg_dump -Fc ... -f old-db/old.dump, сосын pg_restore арқылы OLD_DB-ге ашыңыз.
set -euo pipefail
OLD_DB=${OLD_DB:-korkem_old}
NEW_DB=${NEW_DB:-korkem_invoice}
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

echo "Ескі базадан оқу: $OLD_DB"
psql -X -q -d "$OLD_DB" -v ON_ERROR_STOP=1 <<'SQL'
\copy (select id, name, sort_order, deleted_date is not null from product_category) to 'category.csv' csv
\copy (select id, category_id, name, price, sort_order, deleted_date is not null from product) to 'product.csv' csv
\copy (select id, name, address, deleted_date is not null from client) to 'client.csv' csv
\copy (select id, invoice_number, client_id, created_date, created_by from invoice where deleted_date is null) to 'invoice.csv' csv
\copy (select id, invoice_id, product_id, product_category_id, unit_of_measurement, product_price_with_discount, quantity, discount, total_sum, amount_of_vat, sort_order, created_date from product_item where deleted_date is null) to 'item.csv' csv
SQL

echo "Жаңа базаға жазу: $NEW_DB"
psql -X -q -d "$NEW_DB" -v ON_ERROR_STOP=1 -f "$HERE/migrate.sql"
