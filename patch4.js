const fs = require('fs');
let code = fs.readFileSync('lib/chart-queries.ts', 'utf8');

code = code.replace(/\(SELECT elem->>'level_value_mnemonic' FROM jsonb_array_elements\(f\.geo_code_hierarchy_json->'hierarchy'\) elem WHERE elem->>'level_mnemonic' = 'region' LIMIT 1\) AS region/g,
"(SELECT REPLACE(elem->>'level_value_id', elem->>'level_mnemonic' || '-', '') FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'region' LIMIT 1) AS region");

code = code.replace(/\(SELECT elem->>'level_value_mnemonic' FROM jsonb_array_elements\(f\.geo_code_hierarchy_json->'hierarchy'\) elem WHERE elem->>'level_mnemonic' = 'zone' LIMIT 1\) AS zone/g,
"(SELECT REPLACE(elem->>'level_value_id', elem->>'level_mnemonic' || '-', '') FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'zone' LIMIT 1) AS zone");

code = code.replace(/\(SELECT elem->>'level_value_mnemonic' FROM jsonb_array_elements\(f\.geo_code_hierarchy_json->'hierarchy'\) elem WHERE elem->>'level_mnemonic' = 'woreda' LIMIT 1\) AS woreda/g,
"(SELECT REPLACE(elem->>'level_value_id', elem->>'level_mnemonic' || '-', '') FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'woreda' LIMIT 1) AS woreda");

code = code.replace(/\(SELECT elem->>'level_value_mnemonic' FROM jsonb_array_elements\(f\.geo_code_hierarchy_json->'hierarchy'\) elem WHERE elem->>'level_mnemonic' = 'kebele' LIMIT 1\) AS kebele/g,
"(SELECT REPLACE(elem->>'level_value_id', elem->>'level_mnemonic' || '-', '') FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'kebele' LIMIT 1) AS kebele");

fs.writeFileSync('lib/chart-queries.ts', code);
