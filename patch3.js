const fs = require('fs');
let code = fs.readFileSync('components/farmer-overview-dashboard.tsx', 'utf8');
code = code.replace('id: row.region_code, name: String(row.region || "Unknown").split(/[\\\\s/]/)[0], percent: share(row.farmers),', 'id: row.region_code || row.region, name: String(row.region || "Unknown").replace(/ Ethiopia( People)?/g, ""), percent: share(row.farmers),');
fs.writeFileSync('components/farmer-overview-dashboard.tsx', code);
