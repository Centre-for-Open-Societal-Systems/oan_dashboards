# OAN Dashboards

Public aggregate dashboards for **Access to Credit** and **Grievance Redress**.
Registry dashboards live in the three registry UI repositories, require registry
IAM login, and are built/deployed by their owning registries.

This application has no registry API connections, database credentials or SQL
fallback. Former registry chart, data and export endpoints return 404.
Map endpoints serve public administrative boundaries only; A2C's map uses the
A2C chart service and its own location filters.

## Local development

Copy `.env.example` to an uncommitted `.env.local`, set the A2C/Grievance service
URLs, then run `npm ci` and `npm run dev`. Only configured services are offered.
Gateway API keys are server-side secrets; never use a NEXT_PUBLIC_ variable.

## Verification

Run `npm test`, `npm run lint` and `npx tsc --noEmit`. The boundary regression
test executes the real BFF against local HTTP fixtures and proves former registry
routes cannot be re-enabled through old environment variables or cache entries.
Existing inherited lint debt is documented in the PR validation results.

## Deployment

The existing `Jenkinsfile` and `helm/oan-dashboards` deploy this public application
in Commons. Configure A2C/Grievance URLs and API-key Secret references there.
This is separate from the per-registry dashboard UI/API deployment pipelines.
See [architecture](docs/architecture.md), [configuration](docs/configuration.md)
and [deployment](docs/deployment.md). Never apply cluster objects by hand.
