// server/dashboard-services.ts
//
// Registry data reaches the dashboards through per-registry dashboard services:
// small read-only APIs, one per registry, that own their database access and
// expose aggregate chart data. The BFF holds no registry database credentials;
// it only knows each service's base URL and which chart IDs it serves.
//
// Every service implements the same contract:
//   GET <baseUrl>/api/v1/charts/<chartId>?<filters>  ->  JSON array of rows
//
// Service data is backed by reporting views refreshed on a schedule, so each
// chart+filter combination is fetched at most once per TTL (default 15 min);
// in between, and while a refresh is in flight or failing, the last good rows
// are served.
import { LRUCache } from 'lru-cache'
import type { ChartFilters } from '@/lib/chart-queries'
import { generateCacheKey } from './cache'

type FilterName = keyof ChartFilters

export interface DashboardService {
  /** Stable identifier, used in cache keys and logs. */
  id: string
  /** Environment variable holding the service's base URL. */
  urlEnv: string
  /** Filters the service accepts. Others are not forwarded, so they do not split the cache. */
  filters: readonly FilterName[]
  /** Chart IDs this service serves. */
  charts: readonly string[]
}

const GEO_FILTERS = ['region', 'zone', 'woreda', 'kebele'] as const satisfies readonly FilterName[]

// To add a registry: deploy its dashboard service, add an entry here, and set
// its URL variable. A service whose URL is not set is treated as unavailable.
export const DASHBOARD_SERVICES: readonly DashboardService[] = [
  {
    id: 'farmer-registry',
    urlEnv: 'FARMER_REGISTRY_DASHBOARD_API_URL',
    filters: [...GEO_FILTERS, 'farmingType', 'recordState'],
    charts: [
      'farmerKpis', 'farmersByRegion', 'farmersByZone', 'farmersByWoreda', 'farmersByKebele',
      'farmersByFarmerId', 'farmersByGender', 'farmersByType',
      'farmersByAgeAndGender', 'farmersByEducation', 'landTenureSplit',
      'registryTrendByMonth', 'registryCoverage', 'farmersByRecordState',
      'farmersByImportStatus', 'farmersByPsnpStatus',
    ],
  },
]

const SERVICE_BY_CHART = new Map<string, DashboardService>(
  DASHBOARD_SERVICES.flatMap(service => service.charts.map(chart => [chart, service] as const))
)

export const DASHBOARD_CACHE_TTL_MS = Math.max(60, Number(process.env.DASHBOARD_CACHE_TTL_SECONDS) || 900) * 1000

type Rows = Record<string, unknown>[]
interface FetchContext {
  service: DashboardService
  chartName: string
  query: string
}

function serviceUrl(service: DashboardService): string | undefined {
  const value = process.env[service.urlEnv]
  return value ? value.replace(/\/$/, '') : undefined
}

const createCache = () => new LRUCache<string, Rows, FetchContext>({
  max: 1000,
  ttl: DASHBOARD_CACHE_TTL_MS,
  // Serve stale rows while the refresh runs, and keep them if it fails.
  allowStale: true,
  noDeleteOnStaleGet: true,
  allowStaleOnFetchRejection: true,
  allowStaleOnFetchAbort: true,
  // Reads must not extend the TTL, or a popular key would never refresh.
  updateAgeOnGet: false,
  fetchMethod: async (_key, _stale, { context }) => {
    const { service, chartName, query } = context
    try {
      const base = serviceUrl(service)
      if (!base) {
        throw new Error(`${service.urlEnv} is not set`)
      }
      const res = await fetch(`${base}/api/v1/charts/${chartName}${query ? `?${query}` : ''}`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`returned ${res.status}`)
      }
      return (await res.json()) as Rows
    } catch (error) {
      // Rethrown, not returned: a failure must never be cached as data. Logged
      // here because a failed background refresh is otherwise silent.
      console.warn(`[dashboard-services] ${service.id}/${chartName} refresh failed:`, error instanceof Error ? error.message : error)
      throw error
    }
  },
})

// Next bundles instrumentation.ts (which warms the cache) separately from the
// route handlers (which read it), so a module-level instance would exist twice.
// Keep one per process on globalThis.
const holder = globalThis as typeof globalThis & { __dashboardServiceCache?: ReturnType<typeof createCache> }
const cache = (holder.__dashboardServiceCache ??= createCache())

/** The service that serves a chart, if any. Charts without one run local SQL. */
export function serviceForChart(chartName: string): DashboardService | undefined {
  return SERVICE_BY_CHART.get(chartName)
}

function serviceParams(service: DashboardService, filters: Partial<ChartFilters>): Record<string, string> {
  const params: Record<string, string> = {}
  for (const key of service.filters) {
    const value = filters[key]
    if (value && value !== 'all') params[key] = String(value)
  }
  return params
}

export async function getServiceChart(
  chartName: string,
  filters: Partial<ChartFilters>,
  options: { forceRefresh?: boolean } = {}
): Promise<Rows> {
  const service = serviceForChart(chartName)
  if (!service) {
    throw new Error(`No dashboard service serves ${chartName}`)
  }
  const params = serviceParams(service, filters)
  const rows = await cache.fetch(generateCacheKey(`${service.id}:${chartName}`, params), {
    context: { service, chartName, query: new URLSearchParams(params).toString() },
    forceRefresh: options.forceRefresh ?? false,
  })
  if (rows === undefined) {
    throw new Error(`No data for ${chartName}`)
  }
  return rows
}

// Refreshes the unfiltered view of every chart of every configured service,
// which is what the dashboards open on, so first paint never waits on a service.
export async function warmDashboardServices(): Promise<void> {
  const configured = DASHBOARD_SERVICES.filter(service => {
    if (serviceUrl(service)) return true
    console.warn(`[dashboard-services] ${service.id}: ${service.urlEnv} is not set; its charts are unavailable`)
    return false
  })
  const charts = configured.flatMap(service => service.charts)
  const results = await Promise.allSettled(charts.map(chart => getServiceChart(chart, {}, { forceRefresh: true })))
  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    console.warn(`[dashboard-services] warm-up: ${failed}/${charts.length} charts failed; serving previous data where available`)
  }
}
