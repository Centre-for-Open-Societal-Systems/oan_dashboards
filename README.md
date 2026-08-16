# ATI Farmer Profile Dashboard

Next.js dashboard over a local PostgreSQL database shaped like Odoo / OpenG2P farmer registry tables, plus crop, seed, livestock, and location catalogs.

Four dashboard types are selectable from the sidebar:

| Dashboard | Shows | Data source |
|-----------|-------|-------------|
| **Registries** | Farmer overview, plus crop and livestock registry views, filtered by geography | `scripts/local-schema.sql` + `scripts/seed-local-db.js` |
| **Catalogs** | National reference data and the health of the connections feeding it | `data/catalog/` |
| **A2C - Access to Credit** | Consent-driven loan pipeline for Ethiopian credit providers | `data/a2c/` |
| **DevOps** | Infrastructure health across registry instances, services, hardware and pipelines | `data/devops/` |

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (`createdb`, `psql` on your `PATH`)

## Getting Started

```bash
npm install
cp .env.example .env   # set DB_USER / DB_PASSWORD if needed
npm run db:setup       # create DB, seed farmers, load catalogs + A2C + DevOps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database scripts

`npm run db:setup` loads everything every dashboard needs, so a fresh clone only needs that one command. The individual steps are also runnable on their own:

| Command | What it does |
|---------|----------------|
| `npm run db:setup` | Create `ati_fp_dashboard` if missing, then run all four loaders below |
| `npm run db:seed` | Apply `scripts/local-schema.sql` and insert synthetic registry data |
| `npm run db:catalog` | Load crop / seed / livestock / location SQL from `data/catalog` |
| `npm run db:a2c` | Load the A2C schema and sample data from `data/a2c` |
| `npm run db:devops` | Load the DevOps schema and mock data from `data/devops` |

Optional farmer count:

```bash
npm run db:setup -- --farmers 6000
# or
node scripts/seed-local-db.js --farmers 6000
```

Catalog SQL ships under `data/catalog/`. Override the path with `CATALOG_DATA_DIR` if needed.

### A2C sample data

A2C has no live feed yet, so `data/a2c/` carries the schema plus deterministic sample data (no `random()`, so every deployment gets identical figures). The loaders are plain `psql` scripts, runnable directly:

```bash
cd data/a2c && psql -d ati_fp_dashboard -f run_all.sql
```

| Table | Rows | Contents |
|-------|------|----------|
| `a2c_credit_provider` | 10 | Ethiopian lenders (Coop Bank, Awash, Dashen, ACSI, OCSSCO, DBE, …); 8 live, 2 onboarding |
| `a2c_farmer` | 90 | Enrolled farmers by HDX P-code |
| `a2c_consent_request` | 108 | 78 approved, 20 pending, 10 declined |
| `a2c_loan_application` | 78 | 34 approved, 22 in progress, 12 pending, 10 declined |
| `a2c_registry_data_share` | 234 | Registry payloads sent per application; 4 delivery failures |

The programme footprint matches the reporting locations, all in Oromia. Names and P-codes come from the location catalog, which is also what the map topojson joins on:

| Reported as | Catalog name | P-code | Level | Farmers |
|-------------|--------------|--------|-------|---------|
| Jimma | Jimma (farmers placed in Jimma town) | `ET0404` / `ET040418` | Zone | 50 |
| Gumbichu | Gimbichu, East Shewa | `ET040705` | Woreda | 10 |
| Adea | Ada'a, East Shewa | `ET040706` | Woreda | 30 |

Jimma is a zone rather than a woreda, so its farmers sit in Jimma town to keep the map's zone-to-woreda drill-down resolvable.

### DevOps mock data

Nothing is connected to a monitoring feed, so `data/devops/` carries the schema plus deterministic mock data (no `random()`, so every deployment gets identical figures). Runnable directly:

```bash
cd data/devops && psql -d ati_fp_dashboard -f run_all.sql
```

| Table | Rows | Contents |
|-------|------|----------|
| `devops_platform` | 8 | 4 registry instances (Farmer, Crop Sown, Livestock, Development Agent) and 4 registry services (Access to Credit / Market / Payments / Grievance) |
| `devops_node` | 14 | Hardware in two clusters: `oan-prod` (Addis Ababa DC1) and `oan-dr` (Bahir Dar DC2); control-plane, worker and database roles |
| `devops_app_instance` | 22 | App instances per platform, each pinned to a node |
| `devops_database` | 12 | Postgres: 8 primaries plus 4 read replicas |
| `devops_api_endpoint` | 30 | 19 internal (platform-to-platform) and 11 external (partner) endpoints |
| `devops_pipeline` | 12 | Deployment pipelines, including one estate-wide Terraform pipeline |
| `devops_pipeline_run` | 216 | 18 runs per pipeline; the newest mirrors the pipeline's current state |
| `devops_traffic_sample` | 192 | Hourly requests / errors / p95 per platform over 24 hours |
| `devops_incident` | 6 | Open and recent incidents |

Figures are cross-consistent rather than independently random. Hourly traffic is derived from the per-endpoint 24-hour totals, so the trend chart and the API table agree, and every incident points at a component that exists elsewhere in the dataset:

| Incident | Traces to |
|----------|-----------|
| Disk at 96% (CRITICAL) | node `oan-db-03`, which hosts `livestock_registry_ro`, `a2c` and `a2m` |
| Grievance service crash loop (CRITICAL) | instance `a2g-2`, 17 restarts, which drags the citizen intake endpoint's availability down |
| Payment switch error spike (MAJOR) | external endpoint `/partner/v1/switch/callback` at 4.82%, alongside the degraded `a2p-2` instance |
| Replica lag 148s (MAJOR) | `livestock_registry_ro` on the same pressured node |
| Memory pressure 88% (MINOR) | node `oan-app-05`, where `livestock-registry-3` is degraded |
| Pipeline failing (MINOR) | `da-registry-api`, red at the `integration-test` stage |

Timestamps are anchored to a fixed reference (`2026-08-16 12:00`) rather than `now()`, so relative figures like incident age and replication lag stay coherent however long the data sits in the repo.

### Environment

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=ati_fp_dashboard
```

## Project notes

- Map choropleths use `public/maps/*.topojson.br`, joined to DB admin rows by HDX Pcode (`g2p_*.code`).
- Location catalog geometry is stripped at load time (no PostGIS required); attributes are aligned into `g2p_region` / `g2p_zone` / `g2p_woreda`.
- Docker Compose runs the app only; Postgres is expected on the host (or point `.env` at another instance).
