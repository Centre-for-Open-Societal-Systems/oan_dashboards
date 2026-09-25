# Setup and development

## Prerequisites

- Node.js 20 or later, and npm
- Docker, to run the registry dashboard services locally
- Access to the registries whose dashboards you work on. Each dashboard service needs its registry's
  database with reporting views (for the farmer registry, its Docker Compose stack)

## 1. Configure

```bash
cp .env.example .env
```

Set the URL of each dashboard service you run, for example
`FARMER_REGISTRY_DASHBOARD_API_URL=http://localhost:8005`. `.env` is git-ignored: keep real values
there, and never in `.env.example`. See [Configuration](configuration.md).

## 2. Run the dashboard services

Each registry's dashboard service runs from its own repository. For the farmer registry:

```bash
# in farmer-registry-dashboard-api
cp .env.example .env        # DATABASE_URL for the registry database (read-only role)
docker compose up -d --build
curl http://localhost:8005/health
```

A service you do not run only affects its own charts. They show an error and a warning is logged.

## 3. Run the dashboards

```bash
npm install
npm run dev                 # http://localhost:3000
```

At start-up the server warms the service cache. Services that are unreachable or not configured are
reported as `[dashboard-services] …` warnings.

Tips for development:

- Set `DASHBOARD_CACHE_TTL_SECONDS=60` to see registry changes sooner.
- Restarting `npm run dev` clears the cache.
- Check a batch without the UI:
  `curl "localhost:3000/api/charts?charts=farmerKpis,farmersByGender" | jq .summary`.
  An `executionTime` of about 0 ms means the chart was served from the cache.

## Transitional dashboard database

The Catalogs, Access to Credit and DevOps dashboards (and some Registries panels) still read a
PostgreSQL database directly, until their dashboard services exist. To work on them locally:

1. Create a local database and set `DATABASE_URL` in your `.env`.
2. Load the sample data with the scripts in `scripts/`:
   - `npm run db:setup` / `db:seed` for the application tables
   - `db:catalog`, `db:a2c` and `db:devops` for the domain tables

   The scripts read their connection settings (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`) from your shell environment or your uncommitted `.env`. Use local development
   credentials only.

Do not extend this path. New registry data goes through a dashboard service
([Data integration](data-integration.md)).

## Checks

```bash
npm run lint            # ESLint
npx tsc --noEmit        # type-check
npm run build           # production build
```

There is no automated UI test suite yet. Before submitting a change that affects data, open each
dashboard you touched and try:

- no filters
- a region
- a region and a zone
- farming type *Crop* and *Livestock*

Confirm that `/api/charts` reports `failed: 0` for the charts involved.

## Project layout

```
app/                    Next.js app router: page, layout, API route handlers
components/             dashboards, registry UI kit, map, shadcn/ui primitives
hooks/                  data-fetching hooks
lib/                    transitional SQL catalogue, database pools, formatting
server/                 Elysia BFF, dashboard service map and cache
instrumentation.ts      server start-up hook (service cache warm-up)
data/, scripts/         sample data and loaders for the transitional database
public/maps/            Brotli-compressed TopoJSON boundaries
docs/                   documentation
```
