-- DevOps monitoring schema.
--
-- Models the platform estate the dashboard watches:
--
--   platform (registry or service)
--     ├── app instances     -> run on a node
--     ├── databases         -> Postgres primaries and replicas, on a node
--     ├── API endpoints     -> internal (service-to-service) and external (partner)
--     └── deployment pipelines -> with run history
--   node (the hardware every one of the above sits on)
--   incident (what is currently on fire)
--
-- There is no monitoring feed wired up yet, so the data shipped alongside this
-- schema is MOCK data. Inserts are deterministic (no random()), so every
-- deployment of this repo shows the same estate.

DROP TABLE IF EXISTS "devops_incident" CASCADE;
DROP TABLE IF EXISTS "devops_traffic_sample" CASCADE;
DROP TABLE IF EXISTS "devops_pipeline_run" CASCADE;
DROP TABLE IF EXISTS "devops_pipeline" CASCADE;
DROP TABLE IF EXISTS "devops_api_endpoint" CASCADE;
DROP TABLE IF EXISTS "devops_database" CASCADE;
DROP TABLE IF EXISTS "devops_app_instance" CASCADE;
DROP TABLE IF EXISTS "devops_node" CASCADE;
DROP TABLE IF EXISTS "devops_platform" CASCADE;

-- ---------------------------------------------------------------- platforms

CREATE TABLE "devops_platform" (
    id            INTEGER PRIMARY KEY,
    platform_key  TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    -- Table labels: the icon and kind already say "registry" or "service", so
    -- the short form drops the part the row repeats.
    short_name    TEXT NOT NULL,
    -- REGISTRY holds the master data; SERVICE consumes it over the exchange.
    kind          TEXT NOT NULL,
    -- Drives paging policy: Critical pages out of hours, Standard does not.
    tier          TEXT NOT NULL,
    owner_team    TEXT NOT NULL,
    environment   TEXT NOT NULL,
    version       TEXT NOT NULL,
    onboarded_on  DATE NOT NULL,
    sort_order    INTEGER NOT NULL
);

COMMENT ON TABLE "devops_platform" IS 'Registry and service platforms under monitoring (mock data)';
CREATE INDEX "devops_platform_kind_idx" ON "devops_platform" (kind);

-- ---------------------------------------------------------------- hardware

CREATE TABLE "devops_node" (
    id           INTEGER PRIMARY KEY,
    hostname     TEXT NOT NULL UNIQUE,
    role         TEXT NOT NULL,
    cluster      TEXT NOT NULL,
    datacentre   TEXT NOT NULL,
    cpu_cores    INTEGER NOT NULL,
    memory_gb    INTEGER NOT NULL,
    disk_gb      INTEGER NOT NULL,
    cpu_pct      NUMERIC(5,1) NOT NULL,
    memory_pct   NUMERIC(5,1) NOT NULL,
    disk_pct     NUMERIC(5,1) NOT NULL,
    -- HEALTHY / WARNING / CRITICAL, driven by the saturation figures above.
    status       TEXT NOT NULL,
    uptime_days  INTEGER NOT NULL
);

COMMENT ON TABLE "devops_node" IS 'Physical/virtual hosts backing every platform (mock data)';
CREATE INDEX "devops_node_status_idx" ON "devops_node" (status);
CREATE INDEX "devops_node_role_idx" ON "devops_node" (role);

-- ----------------------------------------------------------- app instances

CREATE TABLE "devops_app_instance" (
    id             INTEGER PRIMARY KEY,
    platform_id    INTEGER NOT NULL REFERENCES devops_platform(id),
    node_id        INTEGER NOT NULL REFERENCES devops_node(id),
    instance_name  TEXT NOT NULL,
    version        TEXT NOT NULL,
    -- RUNNING / DEGRADED / CRASHLOOP / STOPPED
    status         TEXT NOT NULL,
    cpu_pct        NUMERIC(5,1) NOT NULL,
    memory_pct     NUMERIC(5,1) NOT NULL,
    restarts_24h   INTEGER NOT NULL,
    uptime_hours   INTEGER NOT NULL,
    last_deploy_at TIMESTAMP NOT NULL
);

COMMENT ON TABLE "devops_app_instance" IS 'Running application instances per platform (mock data)';
CREATE INDEX "devops_app_instance_platform_idx" ON "devops_app_instance" (platform_id);
CREATE INDEX "devops_app_instance_status_idx" ON "devops_app_instance" (status);

-- --------------------------------------------------------------- databases

CREATE TABLE "devops_database" (
    id                  INTEGER PRIMARY KEY,
    platform_id         INTEGER NOT NULL REFERENCES devops_platform(id),
    node_id             INTEGER NOT NULL REFERENCES devops_node(id),
    db_name             TEXT NOT NULL,
    role                TEXT NOT NULL,
    pg_version          TEXT NOT NULL,
    size_gb             NUMERIC(10,1) NOT NULL,
    connections         INTEGER NOT NULL,
    max_connections     INTEGER NOT NULL,
    -- Replicas only; a primary always reports 0.
    replication_lag_s   NUMERIC(8,1) NOT NULL,
    cache_hit_pct       NUMERIC(5,1) NOT NULL,
    last_backup_at      TIMESTAMP NOT NULL,
    -- HEALTHY / LAGGING / DEGRADED
    status              TEXT NOT NULL
);

COMMENT ON TABLE "devops_database" IS 'Postgres primaries and replicas per platform (mock data)';
CREATE INDEX "devops_database_platform_idx" ON "devops_database" (platform_id);
CREATE INDEX "devops_database_status_idx" ON "devops_database" (status);

-- ----------------------------------------------------------------- APIs

CREATE TABLE "devops_api_endpoint" (
    id               INTEGER PRIMARY KEY,
    platform_id      INTEGER NOT NULL REFERENCES devops_platform(id),
    name             TEXT NOT NULL,
    -- INTERNAL = called by another platform on the exchange.
    -- EXTERNAL = called by a partner outside the platform boundary.
    scope            TEXT NOT NULL,
    method           TEXT NOT NULL,
    path             TEXT NOT NULL,
    consumer         TEXT NOT NULL,
    requests_24h     INTEGER NOT NULL,
    error_rate_pct   NUMERIC(5,2) NOT NULL,
    p95_latency_ms   INTEGER NOT NULL,
    availability_pct NUMERIC(5,2) NOT NULL,
    -- HEALTHY / DEGRADED / DOWN
    status           TEXT NOT NULL
);

COMMENT ON TABLE "devops_api_endpoint" IS 'Internal and external API endpoints per platform (mock data)';
CREATE INDEX "devops_api_endpoint_platform_idx" ON "devops_api_endpoint" (platform_id);
CREATE INDEX "devops_api_endpoint_scope_idx" ON "devops_api_endpoint" (scope);
CREATE INDEX "devops_api_endpoint_status_idx" ON "devops_api_endpoint" (status);

-- ------------------------------------------------------ deployment pipelines

CREATE TABLE "devops_pipeline" (
    id                INTEGER PRIMARY KEY,
    -- NULL for estate-wide pipelines that do not belong to one platform.
    platform_id       INTEGER REFERENCES devops_platform(id),
    name              TEXT NOT NULL,
    repository        TEXT NOT NULL,
    environment       TEXT NOT NULL,
    trigger_type      TEXT NOT NULL,
    -- SUCCESS / FAILED / RUNNING
    last_status       TEXT NOT NULL,
    last_duration_s   INTEGER NOT NULL,
    last_run_at       TIMESTAMP NOT NULL,
    failed_stage      TEXT,
    deploys_30d       INTEGER NOT NULL,
    success_rate_pct  NUMERIC(5,1) NOT NULL,
    lead_time_hours   NUMERIC(6,1) NOT NULL
);

COMMENT ON TABLE "devops_pipeline" IS 'CI/CD deployment pipelines (mock data)';
CREATE INDEX "devops_pipeline_platform_idx" ON "devops_pipeline" (platform_id);
CREATE INDEX "devops_pipeline_status_idx" ON "devops_pipeline" (last_status);

CREATE TABLE "devops_pipeline_run" (
    id           INTEGER PRIMARY KEY,
    pipeline_id  INTEGER NOT NULL REFERENCES devops_pipeline(id),
    run_number   INTEGER NOT NULL,
    status       TEXT NOT NULL,
    duration_s   INTEGER NOT NULL,
    started_at   TIMESTAMP NOT NULL,
    failed_stage TEXT
);

COMMENT ON TABLE "devops_pipeline_run" IS 'Recent run history per pipeline (mock data)';
CREATE UNIQUE INDEX "devops_pipeline_run_uidx" ON "devops_pipeline_run" (pipeline_id, run_number);
CREATE INDEX "devops_pipeline_run_started_idx" ON "devops_pipeline_run" (started_at);

-- ------------------------------------------------------------ traffic series

CREATE TABLE "devops_traffic_sample" (
    id             INTEGER PRIMARY KEY,
    platform_id    INTEGER NOT NULL REFERENCES devops_platform(id),
    sampled_at     TIMESTAMP NOT NULL,
    requests       INTEGER NOT NULL,
    errors         INTEGER NOT NULL,
    p95_latency_ms INTEGER NOT NULL
);

COMMENT ON TABLE "devops_traffic_sample" IS 'Hourly request/error/latency samples over the last day (mock data)';
CREATE UNIQUE INDEX "devops_traffic_sample_uidx" ON "devops_traffic_sample" (platform_id, sampled_at);

-- ---------------------------------------------------------------- incidents

CREATE TABLE "devops_incident" (
    id          INTEGER PRIMARY KEY,
    platform_id INTEGER REFERENCES devops_platform(id),
    title       TEXT NOT NULL,
    component   TEXT NOT NULL,
    -- CRITICAL / MAJOR / MINOR
    severity    TEXT NOT NULL,
    -- OPEN / ACKNOWLEDGED / MITIGATED
    status      TEXT NOT NULL,
    opened_at   TIMESTAMP NOT NULL,
    detail      TEXT NOT NULL
);

COMMENT ON TABLE "devops_incident" IS 'Open and recent infrastructure incidents (mock data)';
CREATE INDEX "devops_incident_severity_idx" ON "devops_incident" (severity);
CREATE INDEX "devops_incident_status_idx" ON "devops_incident" (status);
