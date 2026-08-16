-- Postgres databases (mock data).
--
-- Every platform has a primary; the Critical-tier platforms and the Livestock
-- Registry also carry a read replica. Replicas in the Bahir Dar DR site stream
-- from Addis Ababa, so a little lag is normal — livestock_registry_ro at 148s is
-- not, and has a matching incident.

INSERT INTO "devops_database"
  (id, platform_id, node_id, db_name, role, pg_version, size_gb,
   connections, max_connections, replication_lag_s, cache_hit_pct, last_backup_at, status)
VALUES
  -- Farmer Registry
  (1,  1, 10, 'farmer_registry',        'PRIMARY', '16.4', 412.5, 148, 400,   0.0, 99.2, '2026-08-16 02:00:00', 'HEALTHY'),
  (2,  1, 14, 'farmer_registry_ro',     'REPLICA', '16.4', 412.5,  62, 200,   2.4, 98.7, '2026-08-16 02:00:00', 'HEALTHY'),
  -- Crop Sown Registry
  (3,  2, 10, 'crop_registry',          'PRIMARY', '16.4', 268.0, 104, 400,   0.0, 98.9, '2026-08-16 02:20:00', 'HEALTHY'),
  -- Livestock Registry
  (4,  3, 11, 'livestock_registry',     'PRIMARY', '16.4', 184.5,  96, 400,   0.0, 98.4, '2026-08-16 02:40:00', 'HEALTHY'),
  (5,  3, 12, 'livestock_registry_ro',  'REPLICA', '16.4', 184.5,  44, 200, 148.0, 94.1, '2026-08-16 02:40:00', 'LAGGING'),
  -- Development Agent Registry
  (6,  4, 11, 'da_registry',            'PRIMARY', '16.4',  46.0,  38, 200,   0.0, 99.4, '2026-08-16 03:00:00', 'HEALTHY'),
  -- Access to Credit
  (7,  5, 12, 'a2c',                    'PRIMARY', '16.4',  88.5,  72, 300,   0.0, 99.1, '2026-08-16 03:20:00', 'HEALTHY'),
  (8,  5, 14, 'a2c_ro',                 'REPLICA', '16.4',  88.5,  28, 200,   1.8, 98.6, '2026-08-16 03:20:00', 'HEALTHY'),
  -- Access to Market
  (9,  6, 12, 'a2m',                    'PRIMARY', '16.4',  62.0,  54, 300,   0.0, 98.8, '2026-08-16 03:40:00', 'HEALTHY'),
  -- Access to Payments
  (10, 7, 10, 'a2p',                    'PRIMARY', '16.4', 124.0, 268, 300,   0.0, 97.6, '2026-08-16 04:00:00', 'DEGRADED'),
  (11, 7, 14, 'a2p_ro',                 'REPLICA', '16.4', 124.0,  46, 200,   3.1, 98.2, '2026-08-16 04:00:00', 'HEALTHY'),
  -- Access to Grievance
  (12, 8, 11, 'a2g',                    'PRIMARY', '16.4',  18.5,  22, 200,   0.0, 99.5, '2026-08-16 04:20:00', 'HEALTHY');
