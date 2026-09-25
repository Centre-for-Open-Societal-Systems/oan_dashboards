# Configuration

All configuration is read from server-side environment variables. `.env.example` lists them with
safe placeholder values.

## Secrets policy

- **Never commit real values.** `.env` files are git-ignored. `.env.example` contains no
  credentials.
- **In deployed environments,** supply values from the platform's secret store (for example
  Kubernetes Secrets).
- **Never use `NEXT_PUBLIC_`** for any of these variables. Next.js inlines such values into the
  browser bundle.
- **Target state: no database credentials in the dashboards.** Each registry's database credentials
  belong to that registry's dashboard service. The only database variables here are for the
  transitional path (below) and will be removed.

## Dashboard services

Each registry dashboard service declared in `DASHBOARD_SERVICES` (`server/dashboard-services.ts`)
reads its base URL from its own variable.

| Variable | Service | Example |
| --- | --- | --- |
| `FARMER_REGISTRY_DASHBOARD_API_URL` | Farmer registry | `http://farmer-registry-dashboard-api:8000` (in-cluster) |
| *one variable per additional registry service* | as declared in `DASHBOARD_SERVICES` | |

- The URL must be reachable from the dashboards server. It is not used by browsers.
- If a service's variable is not set, its charts report an error and the rest of the dashboards
  keep working.

| Variable | Default | Description |
| --- | --- | --- |
| `DASHBOARD_CACHE_TTL_SECONDS` | `900` | How long a service response is cached, and how often the unfiltered charts are refreshed in the background. Minimum 60 |

## Transitional: direct database access

These are needed only while the Catalogs, Access to Credit and DevOps dashboards (and some
Registries panels) have no dashboard service yet.

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL of the transitional dashboard database. Use a read-only role |
| `FARMER_DATABASE_URL` | Legacy direct access to the farmer registry database. Not used by the Registries dashboard; leave unset |

Pool settings for these connections are in `lib/config.ts`: up to 20 connections per pool, a
3-second connect timeout, and TCP keep-alive.

## Server

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | set by `next start` | `production` in the container image |

## Build-time settings (`next.config.ts`)

| Setting | Value | Note |
| --- | --- | --- |
| `compress` | `true` | gzip responses |
| `poweredByHeader` | `false` | Hides the framework header |
| `X-Frame-Options`, `Content-Security-Policy: frame-ancestors` | `ALLOWALL`, `*` | Lets a portal embed the dashboards. Restrict `frame-ancestors` to the portal origins in production |
