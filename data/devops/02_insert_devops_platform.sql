-- Platforms under monitoring (mock data).
--
-- Four registries hold the master data; four services consume it over the
-- exchange. Tier drives paging policy, not availability targets.

INSERT INTO "devops_platform"
  (id, platform_key, name, short_name, kind, tier, owner_team, environment, version, onboarded_on, sort_order)
VALUES
  (1, 'farmer-registry',    'Farmer Registry',            'Farmer',    'REGISTRY', 'Critical', 'Registry Platform',  'production', 'v4.2.1', '2024-03-11', 1),
  (2, 'crop-registry',      'Crop Sown Registry',         'Crop Sown', 'REGISTRY', 'High',     'Crop Data',          'production', 'v3.8.0', '2024-07-02', 2),
  (3, 'livestock-registry', 'Livestock Registry',         'Livestock', 'REGISTRY', 'High',     'Livestock Data',     'production', 'v3.5.4', '2024-11-18', 3),
  (4, 'da-registry',        'Development Agent Registry', 'Dev Agent', 'REGISTRY', 'Standard', 'Field Operations',   'production', 'v2.9.3', '2025-05-06', 4),
  (5, 'a2c',                'Access to Credit',           'Credit',    'SERVICE',  'Critical', 'Financial Services', 'production', 'v1.6.0', '2025-09-15', 5),
  (6, 'a2m',                'Access to Market',           'Market',    'SERVICE',  'High',     'Market Linkage',     'production', 'v1.4.2', '2025-11-20', 6),
  (7, 'a2p',                'Access to Payments',         'Payments',  'SERVICE',  'Critical', 'Financial Services', 'production', 'v1.3.1', '2026-01-28', 7),
  (8, 'a2g',                'Access to Grievance',        'Grievance', 'SERVICE',  'Standard', 'Citizen Support',    'production', 'v1.1.0', '2026-04-14', 8);
