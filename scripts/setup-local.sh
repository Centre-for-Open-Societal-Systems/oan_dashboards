#!/usr/bin/env bash
# Bootstrap a local Postgres database with synthetic farmer data, catalogs and
# A2C (Access to Credit) sample data.
#
# Prerequisites: PostgreSQL (createdb/psql), Node.js, npm dependencies installed.
#
# Usage: ./scripts/setup-local.sh [--farmers 6000]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Prefer Homebrew Postgres if present.
if [[ -d /opt/homebrew/opt/postgresql@18/bin ]]; then
  export PATH="/opt/homebrew/opt/postgresql@18/bin:${PATH}"
elif [[ -d /opt/homebrew/opt/postgresql@17/bin ]]; then
  export PATH="/opt/homebrew/opt/postgresql@17/bin:${PATH}"
elif [[ -d /usr/local/opt/postgresql@18/bin ]]; then
  export PATH="/usr/local/opt/postgresql@18/bin:${PATH}"
fi

if [[ ! -f "$ROOT/.env" ]]; then
  if [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    # Fill a sensible local user when the example placeholder is still present.
    if grep -q '^DB_USER=postgres$' "$ROOT/.env" 2>/dev/null; then
      sed -i.bak "s/^DB_USER=postgres$/DB_USER=${USER}/" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
    fi
    echo "Created .env from .env.example (DB_USER=${USER}). Edit if needed."
  else
    echo "Missing .env. Create one with DB_HOST, DB_PORT, DB_USER, DB_NAME." >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Z0-9_]+=' "$ROOT/.env")
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ati_fp_dashboard}"
DB_USER="${DB_USER:-$USER}"

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

for cmd in createdb psql node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

echo "Ensuring database ${DB_NAME} exists..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
  echo "Created database ${DB_NAME}."
else
  echo "Database ${DB_NAME} already exists."
fi

echo ""
echo "=== Seeding application / farmer data ==="
node "$ROOT/scripts/seed-local-db.js" "$@"

echo ""
echo "=== Loading catalog data ==="
"$ROOT/scripts/load-catalog-data.sh"

echo ""
echo "=== Loading A2C (Access to Credit) sample data ==="
"$ROOT/scripts/load-a2c-data.sh"

echo ""
echo "=== Loading DevOps monitoring mock data ==="
"$ROOT/scripts/load-devops-data.sh"

echo ""
echo "Local database is ready. Start the app with: npm run dev"
