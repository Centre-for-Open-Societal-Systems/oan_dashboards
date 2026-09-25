# Data Integration & Query Routing

> **Registries (GEN2 farmer registry):** this page describes the older direct-SQL design. The current design (dashboard API, 15-minute cache) is [farmer-registry-dashboard-design.md](farmer-registry-dashboard-design.md).

A core feature of the `oan_dashboards` architecture is its ability to seamlessly multiplex queries across two entirely different database schemas (the legacy Odoo `res_partner` schema and the new OpenG2P Gen2 schema) without exposing the complexity to the frontend.

## Dynamic Database Routing

When a chart requests data, the request is intercepted by `server/elysia-app.ts`. The API dynamically decides which database connection pool to use based on the contents of the SQL query string defined in `lib/chart-queries.ts`.

```typescript
// server/elysia-app.ts
const isGen2 = baseQuery.includes('g2p_register_farmers');
const activePool = isGen2 ? farmerPool : pool;
const { rows } = await activePool.query(sql, values);
```

- **If the query targets `g2p_register_farmers`**: The engine knows this is a Registries dashboard query and executes it against `FARMER_DATABASE_URL` (`farmer_registry_db`). It also bypasses local ID-to-PCode translation, natively sending standard geographic P-codes (e.g., `ET0410`) to Gen2.
- **Otherwise**: The engine defaults to the standard `DATABASE_URL` (`ati_fp_dashboard`) and executes queries against the local synthetic data tables (like `crop_catalog` or `res_partner`).

## Gen2 Schema Translation (`GEN2_SCOPE`)

The Gen2 farmer registry database (`farmer_registry_db`) stores geographic locations in a complex JSON hierarchy (`geo_code_hierarchy_json`). However, the legacy dashboard UI expects flat columns (`region`, `zone`, `woreda`) for grouping and filtering.

To bridge this gap without migrating data, we utilize a PostgreSQL Common Table Expression (CTE) named `GEN2_SCOPE` in `lib/chart-queries.ts`:

```sql
export const GEN2_SCOPE = `
  WITH rp AS (
    SELECT
      f.internal_record_id,
      (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'region' LIMIT 1) AS region,
      (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'zone' LIMIT 1) AS zone,
      (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'woreda' LIMIT 1) AS woreda,
      (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'kebele' LIMIT 1) AS kebele,
      f.gender,
      'Mixed Farming' AS farming_type,
      'yes' AS is_farmer,
      TRUE AS is_registrant,
      FALSE AS is_group
    FROM g2p_register_farmers f
    WHERE f.record_status = 'ACTIVE'
  )
`
```

### How it Works
1. **JSON Extraction**: It unpacks the `geo_code_hierarchy_json` array on the fly, extracting the `level_value_id` (the P-code) for each administrative level.
2. **Schema Aliasing**: It aliases `g2p_register_farmers f` as `rp` (res_partner) and injects default boolean flags (`is_farmer`, `is_registrant`). It also provides a default `'Mixed Farming'` string since Gen2 abstracts farm profiling away from the core farmer record.
3. **Seamless Integration**: The subsequent `SELECT` statements (like `farmersByZone`) simply query `FROM rp`. The `--- DYNAMIC_FILTERS ---` placeholder safely injects standard `WHERE` clauses (`AND rp.region = $1`) against these aliased CTE columns.
