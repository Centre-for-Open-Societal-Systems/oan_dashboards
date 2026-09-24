const fs = require('fs');
let c = fs.readFileSync('D:/WORK/Protean/OpenG2P/openg2p-workspace/oan_dashboards/lib/chart-queries.ts', 'utf8');

c = c.replace(/farmersByGender:\s*`[^`]*`/, `farmersByGender: \`
    \${GEN2_SCOPE}
    SELECT
      COALESCE(rp.gender, 'Unknown') as gender,
      COUNT(DISTINCT rp.internal_record_id) as farmers
    FROM rp
    WHERE rp.is_registrant = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.gender
    ORDER BY farmers DESC
  \``);

c = c.replace(/farmersByType:\s*`[^`]*`/, `farmersByType: \`
    \${GEN2_SCOPE}
    SELECT
      COALESCE(rp.farming_type, 'Unknown') as farming_type,
      COUNT(DISTINCT rp.internal_record_id) as farmers
    FROM rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.farming_type
    ORDER BY farmers DESC
  \``);

c = c.replace(/farmerKpis:\s*`[^`]*`/, `farmerKpis: \`
    \${GEN2_SCOPE}
    SELECT
      COUNT(DISTINCT rp.internal_record_id) AS total_farmers,
      SUM(CASE WHEN LOWER(rp.gender) = 'female' THEN 1 ELSE 0 END) AS female_farmers,
      SUM(CASE WHEN LOWER(rp.gender) = 'male' THEN 1 ELSE 0 END) AS male_farmers,
      0 AS total_land_size,
      0 AS avg_farm_size,
      0 AS household_heads,
      0 AS farmers_with_owned_land,
      0 AS farmers_with_id,
      0 AS farmers_without_id
    FROM rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      --- DYNAMIC_FILTERS ---
  \``);

fs.writeFileSync('D:/WORK/Protean/OpenG2P/openg2p-workspace/oan_dashboards/lib/chart-queries.ts', c);
console.log("Done replacing queries.");
