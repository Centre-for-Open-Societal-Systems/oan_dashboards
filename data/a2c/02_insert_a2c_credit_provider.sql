-- Credit providers onboarded onto the A2C exchange (sample data).
-- Real Ethiopian lenders active in agricultural finance; onboarding dates,
-- statuses and integration modes are illustrative.

INSERT INTO "a2c_credit_provider"
  (id, name, short_name, provider_type, onboarded_on, status, integration, head_office)
VALUES
  (1,  'Cooperative Bank of Oromia',                'Coop Bank',      'Commercial bank',  '2025-09-15', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (2,  'Awash Bank',                                'Awash',          'Commercial bank',  '2025-10-02', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (3,  'Dashen Bank',                               'Dashen',         'Commercial bank',  '2025-11-11', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (4,  'Bank of Abyssinia',                         'BoA',            'Commercial bank',  '2026-01-13', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (5,  'Amhara Bank',                               'Amhara Bank',    'Commercial bank',  '2026-02-24', 'ACTIVE',     'SFTP batch', 'Bahir Dar'),
  (6,  'Oromia Credit and Saving S.C.',             'OCSSCO',         'Microfinance',     '2026-03-10', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (7,  'Amhara Credit and Saving Institution',      'ACSI',           'Microfinance',     '2026-04-07', 'ACTIVE',     'SFTP batch', 'Bahir Dar'),
  (8,  'Development Bank of Ethiopia',              'DBE',            'Development bank', '2026-05-19', 'ACTIVE',     'REST API',  'Addis Ababa'),
  (9,  'Buusaa Gonofaa Microfinance',               'Buusaa Gonofaa', 'Microfinance',     '2026-07-21', 'ONBOARDING', 'REST API',  'Addis Ababa'),
  (10, 'Wasasa Microfinance',                       'Wasasa',         'Microfinance',     '2026-08-04', 'ONBOARDING', 'Pending',   'Addis Ababa');
