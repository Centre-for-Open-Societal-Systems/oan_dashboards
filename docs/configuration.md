# Configuration

All values are server-side environment variables, supplied by Helm or an
uncommitted local environment file. Never use NEXT_PUBLIC_ for URLs or keys.

| Variable | Purpose |
| --- | --- |
| A2C_DASHBOARD_API_URL | A2C base URL; unset hides A2C |
| A2C_DASHBOARD_API_CHARTS_PATH | Chart prefix, default /api/v1/charts; Kong may use /v1/charts |
| A2C_DASHBOARD_API_KEY | Optional gateway key, from a Secret |
| GRIEVANCE_DASHBOARD_API_URL | Grievance base URL; unset hides Grievance |
| GRIEVANCE_DASHBOARD_API_KEY | Optional gateway key, from a Secret |
| DASHBOARD_CACHE_TTL_SECONDS | Shared row refresh TTL, default 900, minimum 60 |

The `helm/oan-dashboards` chart supplies service URLs through dashboardServices
and API keys through serviceKeysSecret. Old registry service variables and
DATABASE_URL/FARMER_DATABASE_URL have no application consumer and cannot enable
registry data access. Remove obsolete variables and Secret references during
the reviewed deployment; never print their values.
