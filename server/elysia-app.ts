import { Elysia } from 'elysia'
import cors from '@elysiajs/cors'
import { performance } from 'perf_hooks'
import { dataService } from '@/lib/data-service'
import { validateFilters, ChartFilters as ServiceChartFilters } from '@/lib/chart-data-service'
import { CHART_QUERIES, ChartFilters } from '@/lib/chart-queries'
import { pool } from '@/lib/database'
import type { Context } from 'elysia'
import { generateCacheKey, getCachedData, setCachedData } from './cache'

const filterColumnMap = {
  region: { name: 'rp.region', type: 'integer' },
  recordState: { name: 'rp.state', type: 'string' },
  zone: { name: 'rp.zone', type: 'integer' },
  woreda: { name: 'rp.woreda', type: 'integer' },
  kebele: { name: 'rp.kebele', type: 'integer' },
  farmingType: { name: 'rp.farming_type', type: 'stringSet' },
  // The sidebar sends the raw farming_type label, so compare case-insensitively.
  farmerType: { name: 'rp.farming_type', type: 'stringCI' },
} as const

// The sidebar emits short codes while res_partner.farming_type stores human labels
// that vary between the Odoo export and the local seed, so match against every alias.
const FARMING_TYPE_ALIASES: Record<string, string[]> = {
  crop: ['crop', 'crop farming', 'crop production', 'crop_farming', 'cropping'],
  livestock: ['livestock', 'livestock farming', 'livestock rearing', 'livestock_farming', 'pastoral'],
  mixed: ['mixed', 'mixed farming', 'mixed_farming', 'crop and livestock'],
}

export function resolveFarmingTypeAliases(value: string): string[] {
  const key = String(value || '').trim().toLowerCase()
  return FARMING_TYPE_ALIASES[key] || [key]
}

type FilterOverrides = Partial<Record<keyof ChartFilters, string>>

function buildWhereClause(filters: ChartFilters, overrides?: FilterOverrides): { clause: string; values: any[] } {
  const conditions: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') {
      const columnKey = key as keyof typeof filterColumnMap
      const column = filterColumnMap[columnKey]
      const overrideName = overrides?.[columnKey]
      if (column) {
        const columnName = overrideName || column.name
        if (column.type === 'integer') {
          conditions.push(`${columnName} = $${paramIndex++}::integer`)
          values.push(value)
        } else if (column.type === 'stringSet') {
          conditions.push(`LOWER(TRIM(${columnName})) = ANY($${paramIndex++}::text[])`)
          values.push(resolveFarmingTypeAliases(value as string))
        } else if (column.type === 'stringCI') {
          conditions.push(`LOWER(TRIM(${columnName})) = LOWER(TRIM($${paramIndex++}))`)
          values.push(value)
        } else {
          conditions.push(`${columnName} = $${paramIndex++}`)
          values.push(value)
        }
      }
    }
  }

  if (conditions.length === 0) {
    return { clause: '', values: [] }
  }

  return {
    clause: `AND ${conditions.join(' AND ')}`,
    values,
  }
}

async function convertPcodsToIds(filters: any) {
  const convertedFilters = { ...filters }

  try {
    if (filters.region && filters.region !== 'all') {
      const regionResult = await pool.query('SELECT id FROM g2p_region WHERE code = $1', [filters.region])
      if (regionResult.rows.length > 0) {
        convertedFilters.region = regionResult.rows[0].id
      }
    }

    if (filters.zone && filters.zone !== 'all') {
      const zoneResult = await pool.query('SELECT id FROM g2p_zone WHERE code = $1', [filters.zone])
      if (zoneResult.rows.length > 0) {
        convertedFilters.zone = zoneResult.rows[0].id
      }
    }

    if (filters.woreda && filters.woreda !== 'all') {
      const woredaResult = await pool.query('SELECT id FROM g2p_woreda WHERE code = $1', [filters.woreda])
      if (woredaResult.rows.length > 0) {
        convertedFilters.woreda = woredaResult.rows[0].id
      }
    }

    if (filters.kebele && filters.kebele !== 'all') {
      const kebeleResult = await pool.query('SELECT id FROM g2p_kebele WHERE code = $1', [filters.kebele])
      if (kebeleResult.rows.length > 0) {
        convertedFilters.kebele = kebeleResult.rows[0].id
      }
    }

    return convertedFilters
  } catch (error) {
    console.error('Error converting Pcods to IDs:', error)
    return filters
  }
}

const DYNAMIC_FILTERS = '--- DYNAMIC_FILTERS ---'
const A2C_GEO_FILTERS = '--- A2C_GEO_FILTERS ---'
const A2C_PROVIDER_FILTERS = '--- A2C_PROVIDER_FILTERS ---'

// A2C tables carry HDX P-codes and their own provider ids, so its filters are
// matched against the raw codes inside the A2C_SCOPE views and must bypass the
// g2p id conversion the registry queries depend on.
const a2cGeoColumns = {
  region: 'region_pcode',
  zone: 'zone_pcode',
  woreda: 'woreda_pcode',
} as const

// Both clauses are numbered in the order the placeholders appear in A2C_SCOPE
// (geography first), so the returned values line up with the $n they fill.
function buildA2CClauses(filters: ChartFilters): { geo: string; provider: string; values: any[] } {
  const values: any[] = []
  const geo: string[] = []

  for (const [key, column] of Object.entries(a2cGeoColumns)) {
    const value = filters[key as keyof ChartFilters]
    if (value && value !== 'all') {
      geo.push(`${column} = $${values.length + 1}`)
      values.push(value)
    }
  }

  let provider = ''
  if (filters.provider && filters.provider !== 'all') {
    provider = `AND id = $${values.length + 1}::integer`
    values.push(filters.provider)
  }

  return {
    geo: geo.length > 0 ? `AND ${geo.join(' AND ')}` : '',
    provider,
    values,
  }
}

const chartFilterOverrides: Record<string, FilterOverrides> = {
  farmersByWoreda: {
    region: 'rp.region',
    zone: 'rp.zone',
    woreda: 'w.id',
  },
  farmersByKebele: {
    region: 'rp.region',
    zone: 'rp.zone',
    woreda: 'w.id',
    kebele: 'k.id',
  },
  cropAreaByWoreda: {
    region: 'rp.region',
    zone: 'rp.zone',
    woreda: 'w.id',
  },
  cropAreaByKebele: {
    region: 'rp.region',
    zone: 'rp.zone',
    woreda: 'w.id',
    kebele: 'k.id',
  },
}

// Resolves a chart's SQL and its bind values. Which filter dialect a query
// speaks is decided by the placeholder it carries, so callers need not know
// whether a chart is a registry, reference-data or A2C query.
function prepareChartSql(
  chartName: string,
  baseQuery: string,
  filters: ChartFilters,
  convertedFilters: ChartFilters
): { sql: string; values: any[] } {
  if (baseQuery.includes(A2C_GEO_FILTERS)) {
    const { geo, provider, values } = buildA2CClauses(filters)
    return {
      sql: baseQuery.replace(A2C_GEO_FILTERS, geo).replace(A2C_PROVIDER_FILTERS, provider),
      values,
    }
  }

  // Reference-data queries (national catalogues, infrastructure) carry no
  // placeholder at all, so their parameter list must stay empty or pg rejects
  // the bind.
  if (!baseQuery.includes(DYNAMIC_FILTERS)) {
    return { sql: baseQuery, values: [] }
  }

  const overrides = chartFilterOverrides[chartName] || undefined
  const { clause, values } = buildWhereClause(convertedFilters, overrides)
  return { sql: baseQuery.replace(DYNAMIC_FILTERS, clause), values }
}

async function executeChartQuery(chartName: string, filters: ChartFilters, convertedFilters?: ChartFilters) {
  const cacheKey = generateCacheKey(`chart:${chartName}`, filters)

  // Reuse cached DB responses to avoid cold-start penalties on repeated filters
  const cached = getCachedData<any>(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }

  const startTime = performance.now()
  let result: any

  try {
    const baseQuery = CHART_QUERIES[chartName as keyof typeof CHART_QUERIES]
    if (!baseQuery) {
      throw new Error(`Query for chart "${chartName}" not found.`)
    }

    const filtersForQuery = convertedFilters || await convertPcodsToIds(filters)
    const { sql, values } = prepareChartSql(chartName, baseQuery, filters, filtersForQuery)

    const { rows } = await pool.query(sql, values)
    const executionTime = Math.round(performance.now() - startTime)

    result = {
      chartName,
      success: true,
      data: rows,
      error: null,
      executionTime,
    }
  } catch (error: any) {
    const executionTime = Math.round(performance.now() - startTime)
    console.error(`Error executing ${chartName}:`, error)
    result = {
      chartName,
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
    }
  }

  if (result?.success) {
    setCachedData(cacheKey, result)
  }

  return result
}

function parseChartFilters(query: Context['query']): ChartFilters {
  return {
    region: (query.region as string) || 'all',
    recordState: (query.state as string) || (query.recordState as string) || 'all',
    zone: (query.zone as string) || 'all',
    woreda: (query.woreda as string) || 'all',
    kebele: (query.kebele as string) || 'all',
    farmingType: (query.farmingType as string) || 'all',
    farmerType: (query.farmerType as string) || 'all',
    provider: (query.provider as string) || 'all',
  }
}

async function runChartGroup(chartNames: string[], filters: ChartFilters) {
  const convertedFilters = await convertPcodsToIds(filters)
  const resultsArray = await Promise.all(chartNames.map(chartId => executeChartQuery(chartId, filters, convertedFilters)))

  const data: Record<string, any[]> = {}
  const errors: Array<{ chart: string; error: string | null }> = []
  let totalExecutionTime = 0

  resultsArray.forEach(result => {
    data[result.chartName] = result.data
    totalExecutionTime += result.executionTime || 0
    if (!result.success) {
      errors.push({
        chart: result.chartName,
        error: result.error,
      })
    }
  })

  return {
    success: errors.length === 0,
    data,
    errors,
    summary: {
      total: chartNames.length,
      successful: chartNames.length - errors.length,
      failed: errors.length,
      totalExecutionTime,
    },
  }
}

function jsonToCsv(items: any[]): string {
  if (!items || items.length === 0) return ''
  const replacer = (_key: any, value: any) => value === null ? '' : value
  const header = Object.keys(items[0])
  const csv = [
    header.join(','),
    ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
  ].join('\r\n')
  return csv
}

export function createElysiaApp(prefix = '/api') {
  const app = new Elysia({ prefix })
    .use(cors())
    .onStart(async () => {
      await dataService.initialize()
    })
    .get('/health', () => ({
      status: 'ok',
      service: 'elysia',
      timestamp: new Date().toISOString(),
    }))
    .get('/data', async ({ query, set }) => {
      try {
        const filters: any = {
          region: query.region,
          sector: query.sector,
          farmingType: query.farmingType,
          farmerType: query.farmerType,
          householdStatus: query.householdStatus,
          identificationStatus: query.identificationStatus,
          woreda: query.woreda,
          kebele: query.kebele,
          dateRange: query.dateFrom && query.dateTo ? {
            from: new Date(query.dateFrom as string),
            to: new Date(query.dateTo as string)
          } : undefined
        }

        Object.keys(filters).forEach(key => {
          if (filters[key] === undefined) {
            delete filters[key]
          }
        })

        const data = await dataService.getFilteredData(filters)
        const sourceInfo = dataService.getDataSourceInfo()

        return {
          success: true,
          data,
          sourceInfo,
          count: data.length,
          filters,
        }
      } catch (error: any) {
        console.error('API Error:', error)
        set.status = 500
        return {
          success: false,
          error: 'Failed to fetch data',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
    .post('/data', async ({ body, set }) => {
      try {
        const { action, filters, groupBy } = body as any

        switch (action) {
          case 'clearCache':
            dataService.clearCache()
            return { success: true, message: 'Cache cleared' }

          case 'getStats':
            const stats = await dataService.getStats()
            return { success: true, data: stats }

          case 'getAggregated':
            if (!groupBy || !Array.isArray(groupBy)) {
              set.status = 400
              return { success: false, error: 'groupBy parameter is required and must be an array' }
            }
            const aggregatedData = await dataService.getAggregatedData(groupBy)
            return { success: true, data: aggregatedData }

          default:
            set.status = 400
            return { success: false, error: 'Invalid action' }
        }
      } catch (error: any) {
        console.error('API Error:', error)
        set.status = 500
        return {
          success: false,
          error: 'Failed to process request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
    .post('/data/export', async ({ body, set }) => {
      try {
        const { filters, format, filename } = body as any

        if (!filters || !format || !filename) {
          set.status = 400
          return { message: 'Missing required parameters' }
        }

        const data = await dataService.getFilteredData(filters)

        if (format === 'csv') {
          const csvData = jsonToCsv(data)
          return new Response(csvData, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          })
        }

        set.status = 400
        return { message: 'Unsupported format' }
      } catch (error: any) {
        console.error('API Export Error:', error)
        set.status = 500
        return {
          message: 'Failed to export data',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
    .get('/filter-options', async ({ set }) => {
      try {
        const [regions, recordStatuses, farmerTypes] = await Promise.all([
          dataService.getRegions(),
          dataService.getRecordStatuses(),
          dataService.getFarmerTypes(),
        ])
        return { regions, recordStatuses, farmerTypes }
      } catch (error: any) {
        console.error('API Error fetching filter options:', error)
        set.status = 500
        return { message: 'Failed to fetch filter options', error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })
    .get('/locations', async ({ query, set }) => {
      const regionIdOrCode = query.regionId as string | undefined
      const zoneIdOrCode = query.zoneId as string | undefined
      const woredaIdOrCode = query.woredaId as string | undefined

      const resolveId = async (table: string, value: string) => {
        if (!value) return null
        if (!Number.isNaN(Number(value))) return Number(value)
        const res = await pool.query(`SELECT id FROM ${table} WHERE code = $1`, [value])
        return res.rows[0]?.id ?? null
      }

      try {
        if (regionIdOrCode && regionIdOrCode !== 'all') {
          const regionId = await resolveId('g2p_region', regionIdOrCode)
          if (!regionId) return { zones: [] }
          const zones = await pool.query('SELECT id,name,code FROM g2p_zone WHERE region = $1', [regionId])
          return { zones: zones.rows }
        }

        if (zoneIdOrCode && zoneIdOrCode !== 'all') {
          const zoneId = await resolveId('g2p_zone', zoneIdOrCode)
          if (!zoneId) return { woredas: [] }
          const woredas = await pool.query('SELECT id,name,code FROM g2p_woreda WHERE zone = $1', [zoneId])
          return { woredas: woredas.rows }
        }

        if (woredaIdOrCode && woredaIdOrCode !== 'all') {
          const woredaId = await resolveId('g2p_woreda', woredaIdOrCode)
          if (!woredaId) return { kebeles: [] }
          const kebeles = await pool.query('SELECT id,name,code FROM g2p_kebele WHERE woreda = $1', [woredaId])
          return { kebeles: kebeles.rows }
        }

        set.status = 400
        return { error: 'A valid query parameter (regionId, zoneId, or woredaId) is required.' }
      } catch (error: any) {
        console.error('API Error fetching locations:', error)
        set.status = 500
        return { error: 'An internal server error occurred.' }
      }
    })
    .get('/dashboard-data', async ({ query, set }) => {
      try {
        const filters: ChartFilters = {
          region: (query.region as string) || 'all',
          recordState: (query.state as string) || 'all',
          zone: (query.zone as string) || 'all',
          woreda: (query.woreda as string) || 'all',
          kebele: (query.kebele as string) || 'all',
          farmingType: (query.farmingType as string) || 'all',
          farmerType: (query.farmerType as string) || 'all',
        }

        const chartNames = Object.keys(CHART_QUERIES)
        const convertedFilters = await convertPcodsToIds(filters)
        const chartPromises = chartNames.map(chartName => executeChartQuery(chartName, filters, convertedFilters))
        const chartResults = await Promise.all(chartPromises)

        const dashboardData: { [key: string]: any } = {}
        let totalExecutionTime = 0
        let successCount = 0
        let errorCount = 0

        chartResults.forEach(result => {
          dashboardData[result.chartName] = {
            success: result.success,
            data: result.data,
            error: result.error,
            executionTime: result.executionTime
          }

          totalExecutionTime += result.executionTime || 0
          if (result.success) {
            successCount++
          } else {
            errorCount++
          }
        })

        return {
          success: true,
          data: dashboardData,
          summary: {
            totalCharts: chartNames.length,
            successCount,
            errorCount,
            totalExecutionTime,
            filters
          }
        }
      } catch (error: any) {
        console.error('Dashboard data API error:', error)
        set.status = 500
        return {
          success: false,
          message: 'Failed to fetch dashboard data',
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        }
      }
    })
    .get('/dashboard/general', async ({ query }) => {
      const filters = parseChartFilters(query)
      return runChartGroup([
        'farmersByRegion',
        'farmersByType',
        'farmersByImportStatus',
        'farmerKpis',
        'farmersByAgeAndGender',
      ], filters)
    })
    .get('/dashboard/demography', async ({ query }) => {
      const filters = parseChartFilters(query)
      return runChartGroup([
        'demographyStats',
        'farmerPopulationByRegion',
        'genderByRegion',
        'farmersByEducation',
        'farmersByAgeAndGender',
      ], filters)
    })
    .get('/dashboard/socio-economic', async ({ query }) => {
      const filters = parseChartFilters(query)
      return runChartGroup([
        'socioEconomicKpis',
        'householdStatusByGenderRegion',
        'farmersByAgeGroupGenderRegion',
        'farmersByRegion',
        'householdIncomeSources',
      ], filters)
    })
    .get('/dashboard/land', async ({ query }) => {
      const filters = parseChartFilters(query)
      return runChartGroup([
        'landStats',
        'landAreaByRegion',
        'farmersByAgeGroupGenderRegion',
      ], filters)
    })
    .get('/dashboard/admin', async ({ query }) => {
      const filters = parseChartFilters(query)
      return runChartGroup([
        'farmerKpis',
        'farmersByFarmerId',
        'farmersByRegion',
      ], filters)
    })
  .get('/charts', async ({ query, set }) => {
    try {
      const filters: ServiceChartFilters = {
        region: (query.region as string) || undefined,
        zone: (query.zone as string) || undefined,
        woreda: (query.woreda as string) || undefined,
        kebele: (query.kebele as string) || undefined,
        recordState: (query.recordState as string) || (query.state as string) || undefined,
        farmingType: (query.farmingType as string) || undefined,
        farmerType: (query.farmerType as string) || undefined,
        dateFrom: (query.dateFrom as string) || undefined,
        dateTo: (query.dateTo as string) || undefined,
        sector: (query.sector as string) || undefined,
        provider: (query.provider as string) || undefined,
      }

      Object.keys(filters).forEach(key => {
        // @ts-ignore
        if (filters[key] === undefined || filters[key] === 'all') {
          // @ts-ignore
          delete filters[key]
        }
      })

      const validation = validateFilters(filters)
      if (!validation.valid) {
        set.status = 400
        return {
          success: false,
          error: 'Invalid filters',
          details: validation.errors
        }
      }

      const requestedCharts = (query.charts as string | undefined)?.split(',').filter(Boolean)
      const targetCharts = requestedCharts && requestedCharts.length > 0 ? requestedCharts : Object.keys(CHART_QUERIES)

      const convertedFilters = await convertPcodsToIds(filters as any)
      const resultsArray = await Promise.all(targetCharts.map(chartId => executeChartQuery(chartId, filters as any, convertedFilters)))

      const results: Record<string, any> = {}
      let successful = 0
      let failed = 0
      let totalExecutionTime = 0

      resultsArray.forEach(r => {
        results[r.chartName] = r
        totalExecutionTime += r.executionTime || 0
        if (r.success) successful++
        else failed++
      })

      return {
        success: true,
        data: results,
        summary: {
          total: targetCharts.length,
          successful,
          failed,
          totalExecutionTime,
        },
        filters,
        timestamp: new Date().toISOString()
      }
    } catch (error: any) {
      console.error('Charts API Error:', error)
      set.status = 500
      return {
        success: false,
        error: 'Failed to fetch chart data',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
    .get('/charts/:chartId', async ({ params, query, set }) => {
      const chartName = params.chartId

      try {
        const baseQuery = CHART_QUERIES[chartName as keyof typeof CHART_QUERIES]
        if (!baseQuery) {
          set.status = 404
          return { success: false, error: `Chart query '${chartName}' not found.` }
        }

        const filters: ChartFilters = {
          region: (query.region as string) || 'all',
          recordState: (query.recordState as string) || 'all',
          zone: (query.zone as string) || 'all',
          woreda: (query.woreda as string) || 'all',
          kebele: (query.kebele as string) || 'all',
          farmingType: (query.farmingType as string) || 'all',
          farmerType: (query.farmerType as string) || 'all',
          provider: (query.provider as string) || 'all',
        }

        const convertedFilters = await convertPcodsToIds(filters)
        const { sql, values } = prepareChartSql(chartName, baseQuery, filters, convertedFilters)

        const startTime = Date.now()
        const result = await pool.query(sql, values)
        const executionTime = Date.now() - startTime

        return { success: true, data: result.rows, executionTime }
      } catch (error: any) {
        console.error(`API Error for [${chartName}]:`, error)
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unknown database error occurred'
        }
      }
    })

  return app
}
