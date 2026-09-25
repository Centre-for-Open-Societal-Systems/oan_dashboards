# AGENTS.md

Guidance for contributors and coding agents working in this repository. Read the
[README](README.md) and [docs/](docs/) first. This file lists the rules that are easy to get wrong.

## What this is

A Next.js 16 (App Router, React 19) application with four dashboards: Registries, Catalogs, Access
to Credit and DevOps. An Elysia BFF is mounted under `/api` in the same process.

Registry data comes from **per-registry dashboard services**: read-only APIs, one per registry, that
share one HTTP contract. The BFF calls them server-to-server through a shared cache. Some dashboards
still read a transitional database directly until their services exist.

## Key files

```
app/api/[[...slugs]]/route.ts   mounts the Elysia app
server/elysia-app.ts            BFF: filter parsing, chart routing (executeChartQuery), batch endpoints
server/dashboard-services.ts    DASHBOARD_SERVICES (id, URL variable, filters, chart IDs) + response cache
instrumentation.ts              warms the service cache at start-up and every TTL
lib/chart-queries.ts            transitional SQL templates for charts without a service
components/registry/registry-data.ts   labels for registry codes (age bands, tenure), shared helpers
```

## Rules

### Architecture
- New registry data goes through that registry's **dashboard service**. Never add SQL against a
  registry database to this repository, and never add registry database credentials here.
- A chart ID belongs to exactly one service in `DASHBOARD_SERVICES`. Moving a chart to a service
  means implementing it in the service, adding its ID there, and removing its `CHART_QUERIES` entry.
- Service responses must use the keys the component reads (services pin them with contract tests).
  Values are registry codes. Label them in `registry-data.ts`, and never re-bucket them in a
  component.
- Keep the service cache on `globalThis`: `instrumentation.ts` and the route handlers are bundled
  separately.

### Transitional SQL path
- Do not extend it. When you have to touch it, never build a value into SQL. Filters reach it only
  through the placeholders (`--- DYNAMIC_FILTERS ---`, `--- A2C_GEO_FILTERS ---`,
  `--- A2C_PROVIDER_FILTERS ---`) and `$n` parameters. Column and table names come only from the
  fixed maps in `server/elysia-app.ts`.

### Filters
- Each BFF handler (`/charts`, `/charts/:chartId`, `/dashboard-data`, `/dashboard/*`) parses filters
  itself. A new filter has to be added to each of them, to the `filters` of every service that
  supports it, and to the sidebar.

### Configuration and secrets
- Configuration is server-side environment only. Never use the `NEXT_PUBLIC_` prefix for URLs or
  credentials.
- Never commit credentials. `.env.example` holds placeholders only. Document new variables there and
  in `docs/configuration.md`.

## Before handing off

```bash
npm run lint
npx tsc --noEmit
```

- Introduce no new lint or type errors. The known type errors are in `components/ui/calendar.tsx`
  and `components/ui/resizable.tsx`.
- For data changes, check `/api/charts?charts=<ids>` with no filters and with a region filter:
  `summary.failed` must be 0.
- Update `docs/` when behaviour, configuration, a service or a chart contract changes.

## Conventions

- npm is the package manager (`package-lock.json`). The runtime image uses Bun, and `bun.lock` must
  stay consistent when dependencies change.
- Conventional Commits (`feat(registry): …`, `fix: …`, `docs: …`).
- Never commit `.env` files or one-off patch or replace scripts. Edit the source directly.
