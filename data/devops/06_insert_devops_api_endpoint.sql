-- API endpoints (mock data).
--
-- 30 endpoints: 19 INTERNAL (platform-to-platform over the exchange) and
-- 11 EXTERNAL (partners outside the platform boundary).
--
-- Three are degraded, each traceable to something else in this dataset:
--   Livestock breed reference  -> slow, sharing the pressured oan-app-05
--   Payment switch callback    -> error spike from the a2p-2 back-pressure
--   Citizen grievance intake   -> availability hit by the a2g-2 crash loop

INSERT INTO "devops_api_endpoint"
  (id, platform_id, name, scope, method, path, consumer,
   requests_24h, error_rate_pct, p95_latency_ms, availability_pct, status)
VALUES
  -- Farmer Registry
  (1,  1, 'Farmer lookup',            'INTERNAL', 'GET',  '/v1/farmers/{id}',              'A2C, A2M, A2P',        486200, 0.04,  62, 99.99, 'HEALTHY'),
  (2,  1, 'Farmer search',            'INTERNAL', 'POST', '/v1/farmers/search',            'All services',          98400, 0.11, 214, 99.97, 'HEALTHY'),
  (3,  1, 'Household roster',         'INTERNAL', 'GET',  '/v1/households/{id}',           'A2G',                   24600, 0.06,  88, 99.98, 'HEALTHY'),
  (4,  1, 'Registry export',          'EXTERNAL', 'GET',  '/public/v1/registry/export',    'MoA Data Portal',         1840, 0.22, 940, 99.90, 'HEALTHY'),
  -- Crop Sown Registry
  (5,  2, 'Crop parcel lookup',       'INTERNAL', 'GET',  '/v1/parcels/{id}',              'A2C, A2M',             142800, 0.05,  71, 99.98, 'HEALTHY'),
  (6,  2, 'Season summary',           'INTERNAL', 'GET',  '/v1/seasons/{year}',            'A2M',                   18200, 0.09, 186, 99.96, 'HEALTHY'),
  (7,  2, 'Sown area feed',           'INTERNAL', 'GET',  '/v1/sown-area',                 'Dashboards',            36400, 0.07, 132, 99.97, 'HEALTHY'),
  (8,  2, 'Yield estimates',          'EXTERNAL', 'GET',  '/public/v1/yields',             'Ethio-Seed (MoA)',        4260, 0.18, 512, 99.92, 'HEALTHY'),
  -- Livestock Registry
  (9,  3, 'Animal lookup',            'INTERNAL', 'GET',  '/v1/animals/{id}',              'A2C',                   88600, 0.08,  94, 99.96, 'HEALTHY'),
  (10, 3, 'Breed reference',          'INTERNAL', 'GET',  '/v1/breeds',                    'A2C, A2M',              42200, 1.24, 1840, 99.10, 'DEGRADED'),
  (11, 3, 'Herd summary',             'INTERNAL', 'GET',  '/v1/herds/{farmer}',            'A2P',                   21400, 0.12, 168, 99.95, 'HEALTHY'),
  (12, 3, 'ET-LITS sync',             'EXTERNAL', 'POST', '/partner/v1/etlits/sync',       'ET-LITS (MoA)',           2180, 0.32, 1240, 99.84, 'HEALTHY'),
  -- Development Agent Registry
  (13, 4, 'Agent lookup',             'INTERNAL', 'GET',  '/v1/agents/{id}',               'All registries',        64800, 0.03,  58, 99.99, 'HEALTHY'),
  (14, 4, 'Agent assignment',         'INTERNAL', 'POST', '/v1/assignments',               'Field operations',       9600, 0.14, 224, 99.94, 'HEALTHY'),
  (15, 4, 'Field app sync',           'EXTERNAL', 'POST', '/partner/v1/fieldapp/sync',     'DA Mobile App',         31200, 0.28, 486, 99.88, 'HEALTHY'),
  -- Access to Credit
  (16, 5, 'Consent request',          'INTERNAL', 'POST', '/v1/consents',                  'Farmer Registry',       12400, 0.09, 196, 99.96, 'HEALTHY'),
  (17, 5, 'Registry data share',      'INTERNAL', 'POST', '/v1/data-shares',               'Registry exchange',     28600, 0.16, 342, 99.93, 'HEALTHY'),
  (18, 5, 'Loan decision webhook',    'EXTERNAL', 'POST', '/partner/v1/loans/decision',    'Coop Bank, Awash',       6840, 0.34, 604, 99.86, 'HEALTHY'),
  (19, 5, 'Provider directory',       'EXTERNAL', 'GET',  '/partner/v1/providers',         'Credit providers',       2160, 0.11, 148, 99.97, 'HEALTHY'),
  -- Access to Market
  (20, 6, 'Market price feed',        'INTERNAL', 'GET',  '/v1/prices',                    'Dashboards',            76400, 0.06, 104, 99.98, 'HEALTHY'),
  (21, 6, 'Buyer matching',           'INTERNAL', 'POST', '/v1/matches',                   'Crop Registry',         14200, 0.18, 428, 99.92, 'HEALTHY'),
  (22, 6, 'Offtaker portal',          'EXTERNAL', 'POST', '/partner/v1/offers',            'Offtakers',              8620, 0.42, 562, 99.80, 'HEALTHY'),
  (23, 6, 'Commodity exchange quotes','EXTERNAL', 'GET',  '/partner/v1/ecx/quotes',        'ECX',                   11800, 0.26, 336, 99.89, 'HEALTHY'),
  -- Access to Payments
  (24, 7, 'Payment instruction',      'INTERNAL', 'POST', '/v1/payments',                  'A2C',                   34600, 0.21, 288, 99.91, 'HEALTHY'),
  (25, 7, 'Wallet balance',           'INTERNAL', 'GET',  '/v1/wallets/{id}',              'A2C, A2M',              92400, 0.08,  96, 99.97, 'HEALTHY'),
  (26, 7, 'Payment switch callback',  'EXTERNAL', 'POST', '/partner/v1/switch/callback',   'EthSwitch',             18600, 4.82, 2140, 97.20, 'DEGRADED'),
  (27, 7, 'Settlement report',        'EXTERNAL', 'GET',  '/partner/v1/settlements',       'Partner banks',           980, 0.20, 1420, 99.90, 'HEALTHY'),
  -- Access to Grievance
  (28, 8, 'Case intake',              'INTERNAL', 'POST', '/v1/cases',                     'All registries',         6420, 0.24, 262, 99.90, 'HEALTHY'),
  (29, 8, 'Case status',              'INTERNAL', 'GET',  '/v1/cases/{id}',                'Citizen portal',        16800, 0.14, 118, 99.94, 'HEALTHY'),
  (30, 8, 'Citizen grievance intake', 'EXTERNAL', 'POST', '/public/v1/grievances',         'Citizen Portal',         4280, 1.86, 848, 98.60, 'DEGRADED');
