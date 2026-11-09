-- Pack size: how much one unit holds, e.g. 20 kg of paint or 5 l of liquid soap.
-- Stored in a base unit (KG for mass, L for volume); the UI shows grams/millilitres for small packs.
-- V8 fills it from product names such as "20кг", "800гр", "5Л", "500мл".
alter table product add column pack_amount numeric(12, 3);
alter table product add column pack_unit varchar(4);
alter table product add constraint chk_product_pack
    check ((pack_amount is null and pack_unit is null) or (pack_amount > 0 and pack_unit in ('KG', 'L')));
