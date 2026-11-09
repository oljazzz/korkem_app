#!/usr/bin/env bash
# Copies business data from the local database into a deployed one (e.g. the DigitalOcean demo).
#
#   TARGET_DATABASE_URL='postgresql://user:password@host:25060/db?sslmode=require' ./deploy/load-demo-data.sh
#
# Run it after the app's first successful deploy: the target must already have the schema (Flyway).
# Copies products, colours, categories, clients, invoices, payments and company settings.
# Users are NOT copied: the target keeps its own admin (ADMIN_PASSWORD), so local passwords never leave.
# Existing business data in the target is replaced.
set -euo pipefail

SOURCE_DB="${SOURCE_DB:-korkem_invoice}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the target connection string (postgresql://...)}"

TABLES=(category product product_variant client invoice invoice_line payment company_settings)
DUMP="$(mktemp -t korkem-data.XXXXXX).sql"
trap 'rm -f "$DUMP"' EXIT

target() { psql -X -v ON_ERROR_STOP=1 -q "$TARGET_DATABASE_URL" "$@"; }

echo "→ Checking schema versions"
src_version=$(psql -X -At -d "$SOURCE_DB" -c "select max(installed_rank) from flyway_schema_history where success")
dst_version=$(target -At -c "select max(installed_rank) from flyway_schema_history where success" 2>/dev/null || echo "")
if [[ -z "$dst_version" ]]; then
  echo "✗ The target has no schema yet. Deploy the app first and wait until it is running." >&2
  exit 1
fi
if [[ "$src_version" != "$dst_version" ]]; then
  echo "✗ Schema versions differ (local $src_version, target $dst_version). Deploy the same code version first." >&2
  exit 1
fi

echo "→ Dumping local data from $SOURCE_DB"
args=()
for t in "${TABLES[@]}"; do args+=(-t "public.$t"); done
pg_dump -d "$SOURCE_DB" --data-only --no-owner --no-acl --column-inserts --rows-per-insert=500 \
  "${args[@]}" -t public.invoice_number_seq -f "$DUMP"

echo "→ Replacing data in the target"
{
  echo '\o /dev/null'
  echo "begin;"
  echo "truncate $(IFS=,; echo "${TABLES[*]}") restart identity cascade;"
  cat "$DUMP"
  # Identity columns: continue after the copied ids
  for t in "${TABLES[@]}"; do
    [[ "$t" == company_settings ]] && continue
    echo "select setval(pg_get_serial_sequence('public.$t', 'id'), coalesce((select max(id) from public.$t), 0) + 1, false);"
  done
  echo "commit;"
  echo '\o'
} | target

echo "→ Copied:"
target -c "select (select count(*) from product) as products, (select count(*) from client) as clients,
                  (select count(*) from invoice) as invoices, (select count(*) from invoice_line) as lines,
                  (select count(*) from payment) as payments"
