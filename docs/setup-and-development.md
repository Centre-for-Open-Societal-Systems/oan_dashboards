# Setup and Development

This guide outlines how to set up the `oan_dashboards` local development environment, including connecting to the local mock database and the live Gen2 farmer registry database.

## Prerequisites

- **Node.js** (v20+ recommended)
- **npm** (or Bun/Yarn)
- **Docker & Docker Compose** (for running the Gen2 stack and Postgres)

## 1. Environment Configuration

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Ensure your `.env` contains the proper secure connection strings. By default, the Gen2 Docker stack exposes PostgreSQL on port `5432`. We will use this single database instance to host both the Gen2 data and our local mock data.

```ini
# .env

# Connection to the local mock database (Catalogs, A2C, DevOps)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ati_fp_dashboard

# Connection to the Gen2 live database (Registries)
FARMER_DATABASE_URL=postgres://postgres:postgres@localhost:5432/farmer_registry_db
```

## 2. Start the Gen2 Database Stack

The dashboard requires the `farmer-registry-coss-v3` backend to be running to fetch live farmer data. Navigate to that repository and start the stack:

```bash
cd ../farmer-registry-coss-v3
docker compose up -d
```

This ensures `farmer_registry_db` is available on `localhost:5432`.

## 3. Setup the Local Database

Return to the `oan_dashboards` directory and install the dependencies:

```bash
npm install
```

Next, create the `ati_fp_dashboard` database and run the synthetic data seed scripts. These scripts connect to `localhost:5432` using your `DATABASE_URL` credentials.

```bash
# Creates the ati_fp_dashboard database inside the running Postgres container
docker exec farmer-registry-postgres psql -U postgres -c "CREATE DATABASE ati_fp_dashboard;"

# Seed the geographic layouts and local Odoo-mock schema
npm run db:seed

# Load the catalog, A2C, and DevOps mock data
npm run db:catalog
npm run db:a2c
npm run db:devops
```

## 4. Run the Development Server

Start the Next.js frontend:

```bash
npm run dev
```

The unified dashboard will now be available at `http://localhost:3000`. 
- Navigate to the **Registries** page to view live Gen2 farmer data.
- Navigate to **Catalogs** or **Access to Credit** to view the local synthetic data.

## 5. Building for Production

To build an optimized production bundle:

```bash
npm run build
npm start
```

Alternatively, you can use the provided `Dockerfile` to containerize the dashboard:
```bash
docker build -t oan-dashboards .
docker run -p 3000:3000 --env-file .env oan-dashboards
```
