-- Hardware backing the estate (mock data).
--
-- Two clusters: oan-prod in the Addis Ababa data centre, oan-dr as the warm
-- standby in Bahir Dar. Saturation figures drive the status column:
--   HEALTHY  < 85% on every dimension
--   WARNING  85-94% on any dimension
--   CRITICAL >= 95% on any dimension
--
-- oan-app-05 is under memory pressure and oan-db-03 is nearly out of disk;
-- both have matching incidents in 09_insert_devops_incident.sql.

INSERT INTO "devops_node"
  (id, hostname, role, cluster, datacentre, cpu_cores, memory_gb, disk_gb,
   cpu_pct, memory_pct, disk_pct, status, uptime_days)
VALUES
  (1,  'oan-cp-01',  'control-plane', 'oan-prod', 'Addis Ababa DC1',  8,  32,  500, 22.0, 41.0, 38.0, 'HEALTHY',  212),
  (2,  'oan-cp-02',  'control-plane', 'oan-prod', 'Addis Ababa DC1',  8,  32,  500, 19.0, 39.0, 36.0, 'HEALTHY',  212),
  (3,  'oan-cp-03',  'control-plane', 'oan-prod', 'Addis Ababa DC1',  8,  32,  500, 25.0, 44.0, 41.0, 'HEALTHY',  118),
  (4,  'oan-app-01', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 54.0, 61.0, 52.0, 'HEALTHY',   96),
  (5,  'oan-app-02', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 61.0, 68.0, 57.0, 'HEALTHY',   96),
  (6,  'oan-app-03', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 48.0, 57.0, 49.0, 'HEALTHY',   74),
  (7,  'oan-app-04', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 72.0, 76.0, 63.0, 'HEALTHY',   74),
  (8,  'oan-app-05', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 83.0, 88.0, 91.0, 'WARNING',   61),
  (9,  'oan-app-06', 'worker',        'oan-prod', 'Addis Ababa DC1', 16,  64, 1000, 37.0, 45.0, 44.0, 'HEALTHY',   33),
  (10, 'oan-db-01',  'database',      'oan-prod', 'Addis Ababa DC1', 32, 128, 4000, 58.0, 71.0, 66.0, 'HEALTHY',  204),
  (11, 'oan-db-02',  'database',      'oan-prod', 'Addis Ababa DC1', 32, 128, 4000, 63.0, 74.0, 69.0, 'HEALTHY',  204),
  (12, 'oan-db-03',  'database',      'oan-prod', 'Addis Ababa DC1', 32, 128, 4000, 77.0, 82.0, 96.0, 'CRITICAL', 189),
  (13, 'oan-dr-01',  'worker',        'oan-dr',   'Bahir Dar DC2',   16,  64, 1000, 12.0, 28.0, 31.0, 'HEALTHY',  152),
  (14, 'oan-dr-02',  'database',      'oan-dr',   'Bahir Dar DC2',   32, 128, 4000, 21.0, 47.0, 58.0, 'HEALTHY',  152);
