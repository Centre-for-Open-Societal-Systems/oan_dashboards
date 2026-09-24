const fs = require('fs');
let code = fs.readFileSync('components/farmer-overview-dashboard.tsx', 'utf8');

const regex = /name: String\(row.region \|\| "Unknown"\).split\(\/\[\\\\s\/\]\/\)\[0\],\\s*percent: share\(row.farmers\),/g;
const replacement = 'id: row.region_code, name: String(row.region || "Unknown").split(/[\\\\s/]/)[0], percent: share(row.farmers),';
code = code.replace(/name: String\(row\.region \|\| "Unknown"\)\.split\(\/\[\\s\/\]\/\)\[0\],\s*percent: share\(row\.farmers\),/, replacement);

fs.writeFileSync('components/farmer-overview-dashboard.tsx', code);
