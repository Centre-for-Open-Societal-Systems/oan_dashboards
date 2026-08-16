-- Application instances (mock data).
--
-- 22 instances across the 8 platforms, spread over the worker nodes so no
-- platform is pinned to a single host. Three are unhealthy and each has a
-- matching incident:
--   livestock-registry-3 DEGRADED  (sitting on the memory-pressured oan-app-05)
--   a2p-2                DEGRADED  (payment switch adapter back-pressure)
--   a2g-2                CRASHLOOP (bad config in the last deploy)

INSERT INTO "devops_app_instance"
  (id, platform_id, node_id, instance_name, version, status,
   cpu_pct, memory_pct, restarts_24h, uptime_hours, last_deploy_at)
VALUES
  -- Farmer Registry
  (1,  1, 4,  'farmer-registry-1',    'v4.2.1', 'RUNNING',   46.0, 58.0, 0, 412, '2026-07-30 09:15:00'),
  (2,  1, 5,  'farmer-registry-2',    'v4.2.1', 'RUNNING',   51.0, 62.0, 0, 412, '2026-07-30 09:15:00'),
  (3,  1, 6,  'farmer-registry-3',    'v4.2.1', 'RUNNING',   43.0, 55.0, 0, 412, '2026-07-30 09:15:00'),
  (4,  1, 7,  'farmer-registry-4',    'v4.2.1', 'RUNNING',   49.0, 60.0, 1, 288, '2026-07-30 09:15:00'),
  -- Crop Sown Registry
  (5,  2, 4,  'crop-registry-1',      'v3.8.0', 'RUNNING',   38.0, 49.0, 0, 604, '2026-07-22 14:40:00'),
  (6,  2, 5,  'crop-registry-2',      'v3.8.0', 'RUNNING',   41.0, 52.0, 0, 604, '2026-07-22 14:40:00'),
  (7,  2, 6,  'crop-registry-3',      'v3.8.0', 'RUNNING',   35.0, 47.0, 0, 604, '2026-07-22 14:40:00'),
  -- Livestock Registry
  (8,  3, 5,  'livestock-registry-1', 'v3.5.4', 'RUNNING',   44.0, 56.0, 0, 340, '2026-08-02 11:05:00'),
  (9,  3, 6,  'livestock-registry-2', 'v3.5.4', 'RUNNING',   47.0, 59.0, 0, 340, '2026-08-02 11:05:00'),
  (10, 3, 8,  'livestock-registry-3', 'v3.5.4', 'DEGRADED',  79.0, 91.0, 4,  19, '2026-08-02 11:05:00'),
  -- Development Agent Registry
  (11, 4, 7,  'da-registry-1',        'v2.9.3', 'RUNNING',   26.0, 38.0, 0, 892, '2026-07-10 08:20:00'),
  (12, 4, 9,  'da-registry-2',        'v2.9.3', 'RUNNING',   24.0, 36.0, 0, 892, '2026-07-10 08:20:00'),
  -- Access to Credit
  (13, 5, 4,  'a2c-1',                'v1.6.0', 'RUNNING',   57.0, 64.0, 0, 196, '2026-08-08 16:30:00'),
  (14, 5, 7,  'a2c-2',                'v1.6.0', 'RUNNING',   61.0, 67.0, 0, 196, '2026-08-08 16:30:00'),
  (15, 5, 9,  'a2c-3',                'v1.6.0', 'RUNNING',   54.0, 61.0, 0, 196, '2026-08-08 16:30:00'),
  -- Access to Market
  (16, 6, 5,  'a2m-1',                'v1.4.2', 'RUNNING',   33.0, 45.0, 0, 508, '2026-07-26 10:00:00'),
  (17, 6, 8,  'a2m-2',                'v1.4.2', 'RUNNING',   36.0, 48.0, 0, 508, '2026-07-26 10:00:00'),
  -- Access to Payments
  (18, 7, 6,  'a2p-1',                'v1.3.1', 'RUNNING',   64.0, 69.0, 0, 148, '2026-08-10 13:45:00'),
  (19, 7, 7,  'a2p-2',                'v1.3.1', 'DEGRADED',  88.0, 84.0, 2,  31, '2026-08-10 13:45:00'),
  (20, 7, 9,  'a2p-3',                'v1.3.1', 'RUNNING',   62.0, 66.0, 0, 148, '2026-08-10 13:45:00'),
  -- Access to Grievance
  (21, 8, 8,  'a2g-1',                'v1.1.0', 'RUNNING',   21.0, 34.0, 0, 244, '2026-08-06 09:00:00'),
  (22, 8, 9,  'a2g-2',                'v1.1.0', 'CRASHLOOP',  0.0,  0.0, 17,  0, '2026-08-15 17:20:00');
