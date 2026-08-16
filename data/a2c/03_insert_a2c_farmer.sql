-- Farmers enrolled for A2C (sample data).
--
-- Current programme footprint, all in Oromia:
--   Jimma     50 farmers
--   Gumbichu  10 farmers
--   Adea      30 farmers
--
-- P-codes and spellings are taken from the location catalog (eth_zones /
-- eth_woredas), which is also what the map topojson joins on:
--   Jimma    is a ZONE   (ET0404); its farmers are placed in Jimma town (ET040418)
--            so the zone -> woreda drill-down resolves.
--   Gumbichu is the woreda spelled "Gimbichu" (ET040705), East Shewa zone.
--   Adea     is the woreda spelled "Ada'a"    (ET040706), East Shewa zone.

INSERT INTO "a2c_farmer"
  (farmer_ref, region_name, region_pcode, zone_name, zone_pcode, woreda_name, woreda_pcode, enrolled_on)
SELECT
  'A2C-JIM-' || LPAD(n::text, 3, '0'),
  'Oromia', 'ET04',
  'Jimma', 'ET0404',
  'Jimma town', 'ET040418',
  DATE '2026-01-05' + ((n % 180) * INTERVAL '1 day')
FROM generate_series(1, 50) AS n;

INSERT INTO "a2c_farmer"
  (farmer_ref, region_name, region_pcode, zone_name, zone_pcode, woreda_name, woreda_pcode, enrolled_on)
SELECT
  'A2C-GUM-' || LPAD(n::text, 3, '0'),
  'Oromia', 'ET04',
  'East Shewa', 'ET0407',
  'Gimbichu', 'ET040705',
  DATE '2026-02-10' + ((n % 150) * INTERVAL '1 day')
FROM generate_series(1, 10) AS n;

INSERT INTO "a2c_farmer"
  (farmer_ref, region_name, region_pcode, zone_name, zone_pcode, woreda_name, woreda_pcode, enrolled_on)
SELECT
  'A2C-ADE-' || LPAD(n::text, 3, '0'),
  'Oromia', 'ET04',
  'East Shewa', 'ET0407',
  'Ada''a', 'ET040706',
  DATE '2026-01-20' + ((n % 165) * INTERVAL '1 day')
FROM generate_series(1, 30) AS n;
