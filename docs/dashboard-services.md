# Dashboard services

A **dashboard service** is the read-only API through which one registry publishes aggregate
statistics to the dashboards. There is one per registry: farmer, livestock, crop, and so on. The
farmer registry's service,
[farmer-registry-dashboard-api](https://github.com/Centre-for-Open-Societal-Systems/farmer-registry-dashboard-api),
is the reference implementation.

## Responsibilities

A dashboard service:

- runs next to its registry and is the **only** component that holds credentials for that registry's
  database, ideally a read-only role limited to reporting views
- computes each chart as an aggregate query over the registry's reporting views
- returns **aggregates only**: no names, identifiers, contact details or coordinates
- binds every filter value as a query parameter
- is reachable only on the private network (no public ingress, no end-user authentication)

The dashboards BFF:

- maps chart IDs to services and calls them server-to-server
- caches responses and serves stale data when a service is unavailable
- labels registry codes for display

## Contract

Every dashboard service implements the same HTTP interface.

### `GET /api/v1/charts/<chartId>`

- **Query parameters:** optional filters. Services should accept the common set below where it
  applies to their data, and ignore unknown parameters.

  | Parameter | Meaning |
  | --- | --- |
  | `region`, `zone`, `woreda`, `kebele` | Administrative unit codes, levels 1–4 of the geographic hierarchy |
  | `farmingType` | Farming type, case-insensitive |
  | `recordState` | Record status. When absent, services count active records |

  `all`, or leaving a parameter out, means no filter.
- **Response:** `200`, with a JSON **array** of row objects. A chart with no data returns `[]`.
  Counts are integers and measures are numbers. Categorical values are registry codes, and the
  dashboards label them.
- **Errors:** `404` for an unknown chart, `5xx` for failures. The BFF treats any non-2xx response as
  a failed call.

### `GET /health`

`200 {"status": "ok"}` when the service and its database are available. Used by container probes.

### Stability

A chart's response keys are a contract with the dashboard components. Adding keys is compatible.
Renaming or removing keys, changing types, or changing a default filter needs a coordinated change,
or a new `/api/v2`. Each service should pin its contract with tests.

## Registering a service in the dashboards

Services are declared in `DASHBOARD_SERVICES` (`server/dashboard-services.ts`):

```ts
{
  id: 'livestock-registry',                       // cache keys and logs
  urlEnv: 'LIVESTOCK_REGISTRY_DASHBOARD_API_URL', // variable holding the base URL
  filters: [...GEO_FILTERS, 'recordState'],       // filters this service accepts
  charts: ['livestockKpis', 'livestockBySpecies', 'livestockTopWoredas'],
}
```

To add a registry:

1. **Build and deploy** its dashboard service, implementing the contract above. Use the farmer
   registry service as the template.
2. **Declare it** in `DASHBOARD_SERVICES`, listing the chart IDs it serves. A chart ID must belong to
   exactly one service.
3. **Configure** the URL variable in every environment (see [Configuration](configuration.md)).
4. **Remove** the transitional SQL for those chart IDs from `lib/chart-queries.ts`.
5. **Label** any new codes in `components/registry/registry-data.ts`.

A service whose URL variable is not set is treated as unavailable. Its charts report an error, and
the warm-up logs a warning, but the rest of the dashboards keep working.

## Caching

| Behaviour | Detail |
| --- | --- |
| Granularity | One entry per service, chart and filter combination |
| Lifetime | `DASHBOARD_CACHE_TTL_SECONDS`, 900 by default |
| After expiry | The old rows are served immediately and refreshed in the background (one call per key) |
| On failure | The last good rows keep being served, and `[dashboard-services] … refresh failed` is logged |
| Warm-up | At start-up and every TTL, the unfiltered view of every chart of every configured service |
| Load on a service | At most one call per chart and filter combination per TTL for each dashboards server process, independent of viewer count |

Registries refresh their reporting views on their own schedule (hourly for the farmer registry).
The worst-case lag of a figure is therefore that schedule plus one cache period.
