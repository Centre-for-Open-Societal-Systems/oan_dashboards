const fs = require('fs');
let code = fs.readFileSync('server/elysia-app.ts', 'utf8');

const regex = /async function executeChartQuery\([\s\S]*?return result\n}/m;
const newExecuteChartQuery = sync function executeChartQuery(chartName: string, filters: ChartFilters, _?: any) {
  const startTime = performance.now()
  let result: any

  try {
    const qs = new URLSearchParams(Object.entries(filters).filter(([_,v])=>v!=='all')).toString()
    const baseUrl = process.env.NEXT_PUBLIC_FARMER_API_BASE || 'http://localhost:8005'
    const url = \\\\\\/api/v1/charts/\\\?\\\\\\
    const res = await fetch(url)
    
    if (res.ok) {
      const rows = await res.json()
      const executionTime = Math.round(performance.now() - startTime)
      result = { chartName, success: true, data: rows, error: null, executionTime }
      return result
    } else {
       throw new Error('Python API returned ' + res.status)
    }
  } catch (error: any) {
    const executionTime = Math.round(performance.now() - startTime)
    console.error(\\\Error executing \\\:\\\, error)
    result = {
      chartName,
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
    }
  }
  return result
};

code = code.replace(regex, newExecuteChartQuery);

// Remove CHART_QUERIES imports or usages if they exist? No, let's just make the other route use executeChartQuery
const getChartIdRegex = /\.get\('\/charts\/:chartId', async \(\{ params, query, set \}\) => \{[\s\S]*?\}\)/m;
const newGetChartId = .get('/charts/:chartId', async ({ params, query, set }) => {
      const chartName = params.chartId
      const filters = parseChartFilters(query)
      const result = await executeChartQuery(chartName, filters)
      if (!result.success) {
         set.status = 500
      }
      return result
    });
code = code.replace(getChartIdRegex, newGetChartId);

fs.writeFileSync('server/elysia-app.ts', code);
