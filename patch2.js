const fs = require('fs');
let code = fs.readFileSync('server/elysia-app.ts', 'utf8');

const regex = /const baseQuery = CHART_QUERIES\[chartName as keyof typeof CHART_QUERIES\]/g;
const replacement = const pythonEndpoints = ['farmersByRegion', 'farmersByGender', 'farmersByType'];
    if (pythonEndpoints.includes(chartName)) {
      const qs = new URLSearchParams(Object.entries(filters).filter(([_,v])=>v!=='all')).toString();
      const url = \\\http://localhost:8005/api/v1/charts/\\\?\\\\\\;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const rows = await res.json();
          const executionTime = Math.round(performance.now() - startTime);
          const result = { chartName, success: true, data: rows, error: null, executionTime };
          setCachedData(cacheKey, result);
          return result;
        }
      } catch (e) { console.error('Python API fetch failed', e); }
    }
    const baseQuery = CHART_QUERIES[chartName as keyof typeof CHART_QUERIES];

code = code.replace(regex, replacement);
fs.writeFileSync('server/elysia-app.ts', code);
