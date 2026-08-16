-- Open and recent incidents (mock data).
--
-- Every row here points at a specific component elsewhere in this dataset, so
-- an operator can follow an alert straight to the node, instance, database,
-- endpoint or pipeline that raised it.

INSERT INTO "devops_incident"
  (id, platform_id, title, component, severity, status, opened_at, detail)
VALUES
  (1, NULL, 'Database node almost out of disk',      'oan-db-03',              'CRITICAL', 'OPEN',         '2026-08-16 06:42:00',
      'Disk at 96% on oan-db-03. WAL archiving will stall if it reaches 98%. Hosts livestock_registry_ro, a2c and a2m.'),
  (2, 8,    'Grievance service in crash loop',       'a2g-2',                  'CRITICAL', 'ACKNOWLEDGED', '2026-08-15 17:34:00',
      '17 restarts in 24h since the v1.1.0 deploy. Container exits on startup reading an unset queue credential.'),
  (3, 7,    'Payment switch callback error spike',   '/partner/v1/switch/callback', 'MAJOR', 'OPEN',        '2026-08-16 09:05:00',
      'EthSwitch callbacks failing at 4.82% with p95 at 2140ms. a2p-2 is shedding load and the primary is near its connection ceiling.'),
  (4, 3,    'Read replica falling behind',           'livestock_registry_ro',  'MAJOR',    'ACKNOWLEDGED', '2026-08-16 04:18:00',
      'Replication lag 148s against a 30s target. Reads served from this replica may return stale herd data to A2C.'),
  (5, NULL, 'Worker node under memory pressure',    'oan-app-05',             'MINOR',    'MITIGATED',    '2026-08-15 22:10:00',
      'Memory at 88%, disk at 91%. livestock-registry-3 has been throttled; rebalance scheduled for the next maintenance window.'),
  (6, 4,    'Deployment pipeline failing',           'da-registry-api',        'MINOR',    'OPEN',         '2026-08-16 08:19:00',
      'Failed at integration-test on the last three of seven runs. Blocks the v2.9.4 release for the Development Agent Registry.');
