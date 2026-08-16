-- Deployment pipelines and their recent run history (mock data).
--
-- Twelve pipelines: one or two per platform, plus an estate-wide Terraform
-- pipeline that belongs to no single platform (platform_id NULL).
--
-- da-registry-api is currently red (failed at integration-test) and
-- a2p-service is mid-run; both surface as pipeline alerts on the dashboard.

INSERT INTO "devops_pipeline"
  (id, platform_id, name, repository, environment, trigger_type,
   last_status, last_duration_s, last_run_at, failed_stage,
   deploys_30d, success_rate_pct, lead_time_hours)
VALUES
  (1,     1, 'farmer-registry-api',        'oan/farmer-registry',     'production', 'git-push',     'SUCCESS', 486, '2026-08-15 14:20:00', NULL,                18,  94.4,  6.5),
  (2,     1, 'farmer-registry-migrations', 'oan/farmer-registry',     'production', 'manual',       'SUCCESS', 212, '2026-08-15 14:34:00', NULL,                 6, 100.0,  7.0),
  (3,     2, 'crop-registry-api',          'oan/crop-registry',       'production', 'git-push',     'SUCCESS', 402, '2026-08-14 10:05:00', NULL,                12,  91.7,  8.2),
  (4,     3, 'livestock-registry-api',     'oan/livestock-registry',  'production', 'git-push',     'SUCCESS', 438, '2026-08-13 16:40:00', NULL,                 9,  88.9, 11.4),
  (5,     4, 'da-registry-api',            'oan/da-registry',         'production', 'git-push',     'FAILED',  168, '2026-08-16 08:12:00', 'integration-test',   7,  71.4, 14.8),
  (6,     5, 'a2c-service',                'oan/access-to-credit',    'production', 'git-push',     'SUCCESS', 524, '2026-08-15 18:05:00', NULL,                22,  95.5,  4.2),
  (7,     5, 'a2c-partner-sandbox',        'oan/access-to-credit',    'sandbox',    'schedule',     'SUCCESS', 296, '2026-08-16 03:00:00', NULL,                30,  96.7,  2.0),
  (8,     6, 'a2m-service',                'oan/access-to-market',    'production', 'git-push',     'SUCCESS', 468, '2026-08-14 12:30:00', NULL,                14,  92.9,  6.8),
  (9,     7, 'a2p-service',                'oan/access-to-payments',  'production', 'git-push',     'RUNNING', 214, '2026-08-16 11:48:00', NULL,                26,  88.5,  3.6),
  (10,    7, 'a2p-switch-adapter',         'oan/access-to-payments',  'production', 'git-push',     'SUCCESS', 352, '2026-08-16 09:20:00', NULL,                16,  87.5,  5.1),
  (11,    8, 'a2g-service',                'oan/access-to-grievance', 'production', 'git-push',     'SUCCESS', 388, '2026-08-15 17:20:00', NULL,                 8,  87.5,  9.6),
  (12, NULL, 'platform-infrastructure',    'oan/platform-infra',      'production', 'pull-request', 'SUCCESS', 742, '2026-08-12 09:00:00', NULL,                 5,  80.0, 22.4);

-- Eighteen runs per pipeline. Run 18 is the latest and mirrors the pipeline's
-- current state; earlier runs are spaced at the pipeline's own cadence
-- (30 days / deploys_30d) with failures scattered deterministically.
INSERT INTO "devops_pipeline_run"
  (id, pipeline_id, run_number, status, duration_s, started_at, failed_stage)
SELECT
    (p.id - 1) * 18 + r,
    p.id,
    r,
    CASE
        WHEN r = 18 THEN p.last_status
        WHEN ((p.id * 5 + r * 3) % 13) = 0 THEN 'FAILED'
        ELSE 'SUCCESS'
    END,
    CASE
        WHEN r = 18 THEN p.last_duration_s
        ELSE ROUND(p.last_duration_s * (85 + ((p.id * 7 + r * 11) % 31)) / 100.0)::int
    END,
    p.last_run_at - ((18 - r) * (720.0 / GREATEST(p.deploys_30d, 1)) * INTERVAL '1 hour'),
    CASE
        WHEN r = 18 THEN p.failed_stage
        WHEN ((p.id * 5 + r * 3) % 13) = 0
            THEN (ARRAY['unit-test', 'integration-test', 'build', 'security-scan', 'deploy'])[1 + ((p.id + r) % 5)]
        ELSE NULL
    END
FROM "devops_pipeline" p
CROSS JOIN generate_series(1, 18) AS r;
