#!/usr/bin/env bash
# Load the DevOps monitoring schema and mock data into the local
# ati_fp_dashboard database.
#
# There is no monitoring feed wired up yet, so data/devops/ ships deterministic
# mock data: the four registry platforms and four registry services, their app
# instances, Postgres databases, internal and external APIs, the hardware nodes
# underneath them, deployment pipelines with run history, and open incidents.
#
# Usage: ./scripts/load-devops-data.sh
# Optional: DEVOPS_DATA_DIR=/path/to/devops ./scripts/load-devops-data.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVOPS="${DEVOPS_DATA_DIR:-$ROOT/data/devops}"

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

if [[ ! -f "$DEVOPS/run_all.sql" ]]; then
  echo "DevOps data not found at: $DEVOPS" >&2
  echo "Set DEVOPS_DATA_DIR or place SQL under data/devops/." >&2
  exit 1
fi

echo "Loading DevOps mock data into ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Source: ${DEVOPS}"
echo ""

(cd "$DEVOPS" && "${PSQL[@]}" -f run_all.sql)

echo ""
"${PSQL[@]}" -c "
SELECT 'platforms' AS entity, COUNT(*) AS rows FROM devops_platform
UNION ALL SELECT 'nodes (hardware)',  COUNT(*) FROM devops_node
UNION ALL SELECT 'app instances',     COUNT(*) FROM devops_app_instance
UNION ALL SELECT 'databases',         COUNT(*) FROM devops_database
UNION ALL SELECT 'api endpoints',     COUNT(*) FROM devops_api_endpoint
UNION ALL SELECT 'pipelines',         COUNT(*) FROM devops_pipeline
UNION ALL SELECT 'pipeline runs',     COUNT(*) FROM devops_pipeline_run
UNION ALL SELECT 'traffic samples',   COUNT(*) FROM devops_traffic_sample
UNION ALL SELECT 'incidents',         COUNT(*) FROM devops_incident;"

echo "Done."
