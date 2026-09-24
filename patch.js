const fs = require('fs');
let code = fs.readFileSync('server/elysia-app.ts', 'utf8');

const target = "  try {\n    const baseQuery = CHART_QUERIES[chartName as keyof typeof CHART_QUERIES]";
const replacement = "  try {\n    const pythonEndpoints = ['farmersByRegion', 'farmersByGender', 'farmersByType'];\n    if (pythonEndpoints.includes(chartName)) {\n      const qs = new URLSearchParams(Object.entries(filters).filter(([_,v])=>v!=='all')).toString();\n      const url = \\/api/v1/charts/\?\\;\n      const res = await fetch(url);\n      if (res.ok) {\n        const rows = await res.json();\n        const executionTime = Math.round(performance.now() - startTime);\n        const result = { chartName, success: true, data: rows, error: null, executionTime };\n        setCachedData(cacheKey, result);\n        return result;\n      }\n    }\n\n    const baseQuery = CHART_QUERIES[chartName as keyof typeof CHART_QUERIES]";

code = code.replace(target, replacement);
fs.writeFileSync('server/elysia-app.ts', code);
