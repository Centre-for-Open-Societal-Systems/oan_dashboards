# Dashboard services

Only A2C and Grievance are supported. Their chart IDs, accepted filters and
gateway header options are declared in `server/dashboard-services.ts`.

Each call returns aggregate JSON rows, optionally inside a `data` envelope.
The BFF retains the chart keys the existing components expect. A2C uses its
adapter for provider/location filtering and map name-to-code translation;
Grievance uses region/category filters directly.

Do not add registry services, SQL or database credentials here. The per-registry
dashboards and APIs are deployed by the owning registry CI/Helm. Unknown chart
IDs return 404 even if old registry service URL variables are still present.
