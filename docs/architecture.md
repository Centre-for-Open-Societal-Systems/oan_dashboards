# Architecture

The browser loads A2C or Grievance from the public Next.js application. Its
Elysia BFF calls the selected service over HTTP and caches aggregate rows. It
has no database connection or registry API client. Map files contain public
administrative boundaries, not registry records.

`server/dashboard-services.ts` is the complete chart allow-list, with only
`a2c` and `grievance`. Unknown chart IDs are rejected with 404 before cache or
upstream access, including mixed batches with one removed ID. Former `/api/data`,
`/api/data/export`, `/api/dashboard-data`, `/api/dashboard/*`, `/api/filter-options`
and `/api/locations` routes are removed.

`GET /api/config` advertises only configured A2C/Grievance services. `GET /api/health`
is local liveness. `GET /api/charts?charts=<ids>&<filters>` returns per-chart rows,
errors and a summary; `GET /api/charts/<id>` returns one chart. Public map endpoints
remain under `/api/maps/*` for A2C.

The A2C adapter maps service location names to public boundary codes and sends
provider/location filters to A2C. Grievance uses region and category filters.
Gateway API keys stay in server headers and never reach the browser.

The cache uses an A2C/Grievance-specific global name so an old registry cache
cannot be reused on hot reload. It refreshes configured service charts every
TTL and retains last good rows during service failures. An image rollout starts
a fresh process/cache. Registry dashboards require their own IAM sessions and
viewer roles; the public application cannot fetch their chart routes.
