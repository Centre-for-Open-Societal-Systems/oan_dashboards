# Aggregate data integration

The public BFF permits only the A2C and Grievance chart catalogs declared in
`server/dashboard-services.ts`. It forwards filters to the configured service,
adds a server-side API key when configured, and caches aggregate chart rows.
An unknown chart or a mixed batch containing an unknown chart returns 404
before any upstream request. Former registry, database, export and location
routes are unavailable.

Configure `A2C_DASHBOARD_API_URL`, optional `A2C_DASHBOARD_API_CHARTS_PATH`,
`A2C_DASHBOARD_API_KEY`, `GRIEVANCE_DASHBOARD_API_URL` and
`GRIEVANCE_DASHBOARD_API_KEY`. Keys belong in environment Secret references.
The browser never receives these keys. See [configuration](configuration.md)
and [dashboard services](dashboard-services.md) for the contract.

Each registry UI calls only its own authenticated dashboard API. Registry data
and IAM configuration belong in the registry-owned charts and CI pipelines.
