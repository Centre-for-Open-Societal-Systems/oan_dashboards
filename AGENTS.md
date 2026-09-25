# AGENTS.md — oan_dashboards

Next.js 16 (App Router, React 19) dashboards for OpenAgriNet: Registries (GEN2 farmer registry),
Catalogs, Access to Credit (A2C) and DevOps. The server-side API is an **Elysia** app mounted inside
Next, and it acts as the BFF.

The GEN2 Registries work is tracked in Jira **G2R-212**. Its design doc is
`docs/farmer-registry-dashboard-design.md`, and it is authoritative for anything registry-related.
It replaces the registry sections of `docs/architecture.md` and `docs/data-integration.md`, which
still describe the old direct-SQL (`GEN2_SCOPE`) design.

## Layout (the parts that matter)

```
app/api/[[...slugs]]/route.ts   mounts createElysiaApp('/api') for every HTTP method
app/api/maps/[level]/route.ts   GeoJSON/topojson for the Ethiopia map
server/elysia-app.ts            BFF: filter parsing, chart routing (executeChartQuery), batch endpoints
server/registry-cache.ts        REGISTRY_CHARTS + 15-min stale-while-revalidate cache in front of the dashboard API
instrumentation.ts              warms the unfiltered registry charts at boot and every TTL
server/cache.ts                 older LRU (5 min, extends on read). Used by dashboard-data.ts only
lib/chart-queries.ts            CHART_QUERIES: chart ID → SQL for everything not served by the Python API
lib/database.ts, lib/config.ts  pg Pools: `pool` (ati_fp_dashboard) and `farmerPool` (farmer_registry_db)
hooks/use-data.ts               client fetchers → /api/charts?charts=…&<filters>
components/registry/*, farmer-overview-dashboard.tsx, demography-charts.tsx, …   chart UIs
data/**, scripts/**             seed SQL + loaders for the synthetic ati_fp_dashboard DB
```

## Chart data routing (read before touching a chart)

`executeChartQuery` in `server/elysia-app.ts` decides where each chart ID is served from:

- **Chart ID in `REGISTRY_CHARTS`** (`server/registry-cache.ts`) → `getRegistryChart()`. This
  reads the 15-minute cache, which calls `${FARMER_API_BASE}/api/v1/charts/<id>` on a miss or after
  expiry. The API is the `farmer-registry-dashboard-api` sibling repo and serves live GEN2 data from
  the `fr_rpt_*` views.
- **Anything else** → SQL from `CHART_QUERIES`, run on `pool` (`ati_fp_dashboard`: synthetic
  catalog/A2C/devops data **and** the legacy Odoo `res_partner` mock).

Consequences:
- Moving a registry chart to GEN2 means two changes: implement it in the API, and add its ID to
  `REGISTRY_CHARTS`. You may leave the `CHART_QUERIES` entry as documentation of the expected row
  shape, but it becomes dead code.
- The API must return the **same keys and value vocabulary** that the component reads. A mismatch
  does not raise an error; the chart just renders empty. The API's contract tests pin the keys.
  Enum values (age bands, tenure) are labelled in the UI through `components/registry/registry-data.ts`
  (`ageBandLabel`, `tenureLabel`). Do not re-bucket them.
- Registry numbers can be up to one TTL (15 min) behind the API. To see a change immediately in dev,
  restart `npm run dev` or set `REGISTRY_CACHE_TTL_SECONDS=60`. Keep the cache on globalThis:
  `instrumentation.ts` and the route handlers are bundled separately.
- Several charts on the Registries page still read the mock (design doc G-8). Do not assume a
  number on that page is live.

## Filters

The query params are `region, zone, woreda, kebele` (HDX P-codes such as `ET04`), `farmingType`,
`farmerType`, `recordState` (`state` is also accepted on some routes), and `provider` (A2C). `'all'`
or a missing value means no filter. Each handler (`/charts`, `/charts/:id`, `/dashboard-data`,
`/dashboard/*`) parses filters itself. A new filter has to be added to every handler and to
`build_where_clause` in the API.

SQL in `CHART_QUERIES` gets its filters through placeholders that `prepareChartSql` expands with
`pg` `$n` params:
- `--- DYNAMIC_FILTERS ---` → `AND rp.<col> = $n …` (registry/mock queries; geography converted from
  P-code to integer id first)
- `--- A2C_GEO_FILTERS ---` / `--- A2C_PROVIDER_FILTERS ---` → raw P-code / provider id (A2C)
- no placeholder → filters are ignored (catalog/devops reference data)

Never build a value into a SQL string. Column or table names may only come from literals in
`elysia-app.ts`.

## Run

```bash
cp .env.example .env    # DATABASE_URL, FARMER_DATABASE_URL, FARMER_API_BASE, REGISTRY_CACHE_TTL_SECONDS
npm install
npm run db:seed && npm run db:catalog && npm run db:a2c && npm run db:devops   # first time only
npm run dev             # http://localhost:3000
```

Registries need the registry stack (`farmer-registry-coss-v3`, started with
`docker compose -p farmer-registry-v3 up -d`) and the Python API on `:8005`. See
`docs/setup-and-development.md` and design doc §8.

## Checks

There is no test runner. Before handing off:

```bash
npm run lint
npx tsc --noEmit        # 6 errors in components/ui/{calendar,resizable}.tsx are older than this work; add none
curl -s "localhost:3000/api/charts?charts=farmerKpis,farmersByGender,registryTrendByMonth" | jq '.summary'
```

`summary.failed` must be 0 for the charts you touched, both with no filters and with a region
filter set. Once the cache is warm, `executionTime` for a registry chart is about 0 ms. A few
hundred ms means the request went to the API.

## Conventions and gotchas

- The package manager in practice is **npm** (`package-lock.json`). The Dockerfile builds with
  npm/Node 20 and runs on Bun. `bun.lock` is also present, so keep both lockfiles consistent when
  you add dependencies.
- `NEXT_PUBLIC_*` variables are inlined into the browser bundle. Server-only URLs and credentials
  must not use that prefix. Use `FARMER_API_BASE`; the old `NEXT_PUBLIC_FARMER_API_BASE` is only a
  one-release fallback.
- `next.config.ts` allows framing from any origin on purpose, because the dashboards are embedded
  in a portal. Do not tighten this without checking with the embedding team.
- Do not commit scratch scripts (`patch*.js`, `replace.js`, `fix_queries.*`, and the like). Edit the
  source directly.
- Remotes: `origin` = `Centre-for-Open-Societal-Systems/oan_dashboards` (upstream), and `asmit` = a
  personal fork. Feature branches go to the fork, and PRs go into upstream `develop`.
- Commits use Conventional Commits. No AI co-author trailers.
