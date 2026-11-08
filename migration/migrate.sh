#!/usr/bin/env bash
# Copies data from the legacy Jmix database (OLD_DB) into the new database (NEW_DB).
# The category/product/client/invoice tables in NEW_DB are TRUNCATED; users are left untouched.
#
#   OLD_DB=korkem_old NEW_DB=korkem_invoice ./migration/migrate.sh
#
# Get the legacy database with pg_dump -Fc ... -f old-db/old.dump, then pg_restore it into OLD_DB.
set -euo pipefail
OLD_DB=${OLD_DB:-korkem_old}
NEW_DB=${NEW_DB:-korkem_invoice}
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

echo "Reading legacy database: $OLD_DB"
psql -X -q -d "$OLD_DB" -v ON_ERROR_STOP=1 <<'SQL'
\copy (select id, name, sort_order, deleted_date is not null from product_category) to 'category.csv' csv
\copy (select id, category_id, name, price, sort_order, deleted_date is not null from product) to 'product.csv' csv
\copy (select id, name, address, deleted_date is not null from client) to 'client.csv' csv
\copy (select id, invoice_number, client_id, created_date, created_by from invoice where deleted_date is null) to 'invoice.csv' csv
\copy (select id, invoice_id, product_id, product_category_id, unit_of_measurement, product_price_with_discount, quantity, discount, total_sum, amount_of_vat, sort_order, created_date from product_item where deleted_date is null) to 'item.csv' csv
SQL

echo "Writing new database: $NEW_DB"
psql -X -q -d "$NEW_DB" -v ON_ERROR_STOP=1 -f "$HERE/migrate.sql"
