#!/usr/bin/env bash
# Load the A2C (Access to Credit) schema and sample data into the local
# ati_fp_dashboard database.
#
# A2C has no live feed yet, so data/a2c/ ships deterministic sample data:
# credit providers, farmer consents, loan applications and registry data shares
# for Jimma, Gumbichu (Gimbichu) and Adea (Ada'a).
#
# Usage: ./scripts/load-a2c-data.sh
# Optional: A2C_DATA_DIR=/path/to/a2c ./scripts/load-a2c-data.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A2C="${A2C_DATA_DIR:-$ROOT/data/a2c}"

# Prefer Homebrew Postgres if present, otherwise use whatever `psql` is on PATH.
if [[ -d /opt/homebrew/opt/postgresql@18/bin ]]; then
  export PATH="/opt/homebrew/opt/postgresql@18/bin:${PATH}"
elif [[ -d /opt/homebrew/opt/postgresql@17/bin ]]; then
  export PATH="/opt/homebrew/opt/postgresql@17/bin:${PATH}"
elif [[ -d /usr/local/opt/postgresql@18/bin ]]; then
  export PATH="/usr/local/opt/postgresql@18/bin:${PATH}"
fi

# shellcheck disable=SC1091
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z0-9_]+=' "$ROOT/.env")
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ati_fp_dashboard}"
DB_USER="${DB_USER:-$USER}"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools and retry." >&2
  exit 1
fi

if [[ ! -f "$A2C/run_all.sql" ]]; then
  echo "A2C data not found at: $A2C" >&2
  echo "Set A2C_DATA_DIR or place SQL under data/a2c/." >&2
  exit 1
fi

echo "Loading A2C sample data into ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Source: ${A2C}"
echo ""

(cd "$A2C" && "${PSQL[@]}" -f run_all.sql)

echo ""
"${PSQL[@]}" -c "
SELECT 'credit providers' AS entity, COUNT(*) AS rows FROM a2c_credit_provider
UNION ALL SELECT 'farmers',            COUNT(*) FROM a2c_farmer
UNION ALL SELECT 'consent requests',   COUNT(*) FROM a2c_consent_request
UNION ALL SELECT 'loan applications',  COUNT(*) FROM a2c_loan_application
UNION ALL SELECT 'registry data shares', COUNT(*) FROM a2c_registry_data_share;"

echo "Done."
