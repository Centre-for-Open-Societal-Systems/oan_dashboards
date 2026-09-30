# Data integration

This document explains how a chart gets its data:

- how chart IDs are routed
- how filters become service parameters or SQL
- how to add or move a chart

## Chart IDs

Every panel asks for its data by **chart ID** (for example `farmerKpis`, `a2cLoanTrend`). A chart ID
is served in one of two ways:

| Route | Chart IDs | Source |
| --- | --- | --- |
| **Dashboard service** (target) | IDs declared in `DASHBOARD_SERVICES` (`server/dashboard-services.ts`) | The owning registry's dashboard service, through the service cache |
| **Local SQL** (transitional) | every other key of `CHART_QUERIES` (`lib/chart-queries.ts`) | The transitional dashboard database (`DATABASE_URL`) |

`executeChartQuery` (`server/elysia-app.ts`) checks the service map first (`serviceForChart`). Any
other ID must exist in `CHART_QUERIES`, and an unknown ID returns `success: false`.

### Transitional chart catalogue

Each group below moves to its registry's dashboard service as that service becomes available.

| Group | Chart IDs | Current source |
| --- | --- | --- |
| Farmer registry panels not yet on the service | `landStats`, `landAreaByRegion`, `demographyStats`, `socioEconomicKpis`, `recentRegistrations`, `householdIncomeSources` | `res_partner` and related `g2p_*` tables |
| Catalogs | `catalog*` | `crop_catalog`, `crop_variety`, `livestock_*`, `seed_*`, location catalogue |
| DevOps | `devops*` | `devops_*` tables |

## Filters

The filter options themselves (units, record statuses) come from the map boundaries and the farmer
registry dashboard service; see [Architecture](architecture.md#filter-options).

The UI sends filters as query parameters on `/api/charts`:

| Parameter | Set by | Meaning |
| --- | --- | --- |
| `region`, `zone`, `woreda`, `kebele` | Geography filters, map clicks | Administrative codes, for example `ET04`, `ET0413` |
| `farmingType` | Farming Type | `crop`, `livestock`, `mixed` |
| `farmerType` | Type of Farmer | Farmer type label |
| `recordState` (or `state`) | Record Status | Record status |
| `provider` | Credit Provider (Access to Credit only) | Participating bank id |

`all`, or leaving the parameter out, means no filter.

### Dashboard service charts

Each service receives only the filters listed in its `filters` entry, unchanged. For the farmer
registry these are `region`, `zone`, `woreda`, `kebele`, `farmingType` and `recordState`; the
livestock and crop sown services take the same set without `farmingType`, which on those views only
selects the view. Each
service documents how it applies them; the farmer registry service, for example, counts only active
records when `recordState` is absent. Filters a service does not accept are not forwarded, so they
do not split the cache.

A service can instead declare an `adapter` (`ServiceAdapter`) that builds a chart's rows from the
dashboard's filters and calls to its own charts. Access to Credit uses one (`server/a2c-service.ts`)
because the A2C platform keeps locations as the names the farmer registry sent, not codes:

- A selected region, zone or woreda is sent as the A2C names that resolve to it (`region` and
  `woreda`, comma-separated), taken from the service's own `a2cFilterLocations`. A zone is sent as
  its woredas. `provider` is passed through.
- Names in rows are resolved to boundary units, case- and punctuation-insensitively, a woreda within
  its region. The zone series is rolled up from woredas, and `a2cFilterLocations` gains its codes.
  A place that does not resolve keeps its row without a code.
- A2C records stop at woreda, so `a2cLoansByKebele` is always empty.

### Local SQL charts (transitional)

A SQL template declares which filters it accepts by carrying a placeholder:

| Placeholder | Expanded by | Produces |
| --- | --- | --- |
| `--- DYNAMIC_FILTERS ---` | `buildWhereClause` | `AND rp.region = $1::integer AND …`. Geography codes are first converted to the integer ids of the `g2p_region`/`g2p_zone`/`g2p_woreda`/`g2p_kebele` tables (`convertPcodsToIds`). `farmingType` is matched against known aliases |
| none | — | Filters are ignored (reference data) |

Column names come from fixed maps (`filterColumnMap` and `chartFilterOverrides`
for charts that join on a different alias). Values are always bound as `$n` parameters.

## Response format

`GET /api/charts?charts=a,b` returns:

```json
{
  "success": true,
  "data": {
    "a": { "chartName": "a", "success": true, "data": [ { "...": "..." } ], "error": null, "executionTime": 1 },
    "b": { "chartName": "b", "success": false, "data": [], "error": "…", "executionTime": 12 }
  },
  "summary": { "total": 2, "successful": 1, "failed": 1, "totalExecutionTime": 13 },
  "filters": { "region": "ET04" },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`useChartGroupData` turns this into `{ data: { a: rows, b: [] }, errors: [...] }` for components.

`executionTime` shows how a chart was served:

- about 0–1 ms from the service cache
- a few hundred ms for a call to a service
- the query time for local SQL

## Adding a chart

### From a dashboard service (the standard path)

1. Implement the chart in the owning registry's dashboard service, with a contract test and API
   documentation.
2. Add the chart ID to that service's `charts` in `DASHBOARD_SERVICES`.
3. Request it from the component with `useChartGroupData([..., 'newChart'], filters)`.
4. Label registry codes through helpers in `components/registry/registry-data.ts`. Do not re-bucket
   them.

If the registry has no dashboard service yet, create one (see
[Dashboard services](dashboard-services.md)) rather than adding SQL here.

### Moving a transitional chart to a service

1. Implement it in the service, returning the keys the component already reads. Values may be
   registry codes, as long as the component labels them.
2. Add the chart ID to the service's `charts`.
3. Delete its entry from `CHART_QUERIES`.
4. When a dashboard no longer has any local SQL charts, remove its tables and seed data from the
   transitional database. When none remain, remove `DATABASE_URL`.

### Changing a transitional SQL chart

Only fix what is needed. Never build values into the SQL string, and never take a column name from
the request.
