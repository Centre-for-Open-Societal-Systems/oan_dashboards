// server/dashboard-services.ts
//
// Registry data reaches the dashboards through per-registry dashboard services:
// small read-only APIs, one per registry, that own their database access and
// expose aggregate chart data. The BFF holds no registry database credentials;
// it only knows each service's base URL and which chart IDs it serves.
//
// Every service implements the same contract:
//   GET <baseUrl>/api/v1/charts/<chartId>?<filters>  ->  JSON array of rows
// A service may wrap the array in an envelope as `{ data: [...] }`.
//
// A service whose data does not line up with the dashboards one-to-one (other
// filter values, a chart assembled from several of its own) declares an adapter
// that translates in both directions.
//
// Service data is backed by reporting views refreshed on a schedule, so each
// chart+filter combination is fetched at most once per TTL (default 15 min);
// in between, and while a refresh is in flight or failing, the last good rows
// are served.
import { LRUCache } from 'lru-cache'
import type { ChartFilters } from '@/lib/chart-queries'
import { generateCacheKey } from './cache'
import { a2cAdapter } from './a2c-service'

type FilterName = keyof ChartFilters
export type Rows = Record<string, unknown>[]

/** Calls the service for one of its own charts with the given query parameters. */
export type ServiceCall = (serviceChart: string, params: Record<string, string>) => Promise<Rows>

export interface ServiceAdapter {
  /** Rows for a dashboard chart, given the dashboard's filters and a way to call the service. */
  rows(chartName: string, filters: Partial<ChartFilters>, call: ServiceCall): Promise<Rows>
}

export interface DashboardService {
  /** Stable identifier, used in cache keys and logs. */
  id: string
  /** Environment variable holding the service's base URL. */
  urlEnv: string
  /**
   * Environment variable that may override the charts path (default `/api/v1/charts`),
   * for a service reached through a gateway that exposes it under another prefix.
   */
  pathEnv?: string
  /** Filters the service accepts. Others are not forwarded, so they do not split the cache. */
  filters: readonly FilterName[]
  /** Chart IDs this service serves. */
  charts: readonly string[]
  /** Translation between the dashboards and the service, when they differ. */
  adapter?: ServiceAdapter
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
  {
    id: 'livestock-registry',
    urlEnv: 'LIVESTOCK_REGISTRY_DASHBOARD_API_URL',
    filters: [...GEO_FILTERS, 'recordState'],
    charts: [
      'livestockKpis', 'livestockBySpecies', 'livestockByBreed',
      'livestockKeepersByRegion', 'livestockKeepersByZone', 'livestockKeepersByWoreda', 'livestockKeepersByKebele',
      'livestockTopWoredas', 'herdHealthSplit', 'livestockVaccinationStatus', 'livestockBySex',
      'livestockTrendByMonth', 'livestockByState', 'livestockByRecordState',
    ],
  },
  {
    id: 'cropsown-registry',
    urlEnv: 'CROPSOWN_REGISTRY_DASHBOARD_API_URL',
    filters: [...GEO_FILTERS, 'recordState'],
    charts: [
      'cropKpis', 'cropAreaByCrop',
      'cropAreaByRegion', 'cropAreaByZone', 'cropAreaByWoreda', 'cropAreaByKebele',
      'cropTopWoredas', 'cropLandTenureSplit', 'cropBySeason', 'cropTrendByMonth',
      'cropByStatus', 'cropByLifecycleStage', 'cropByRecordState',
    ],
  },
  {
    // Access to Credit, served by the A2C platform itself. It keeps locations as
    // names rather than P-codes, so its adapter maps them onto the boundaries.
    id: 'a2c',
    urlEnv: 'A2C_DASHBOARD_API_URL',
    // Frappe serves the charts under /api/v1; A2C's Kong gateway exposes them as /v1.
    pathEnv: 'A2C_DASHBOARD_API_CHARTS_PATH',
    filters: ['provider', 'region', 'zone', 'woreda'],
    charts: [
      'a2cKpis', 'a2cProviders', 'a2cLocationSummary',
      'a2cLoansByRegion', 'a2cLoansByZone', 'a2cLoansByWoreda', 'a2cLoansByKebele',
      'a2cApplicationStatus', 'a2cConsentStatus', 'a2cLoanProducts', 'a2cLoanTrend',
      'a2cDataShares', 'a2cDataShareFaults', 'a2cDeclineReasons',
      'a2cFilterProviders', 'a2cFilterLocations',
    ],
    adapter: a2cAdapter,
  },
  {
    // Grievance redress, served by the grievance service from rollups it
    // refreshes every 15 minutes. Regions are P-codes already, so no adapter.
    id: 'grievance',
    urlEnv: 'GRIEVANCE_DASHBOARD_API_URL',
    filters: ['region', 'category'],
    charts: [
      'grvKpis', 'grvPerformanceKpis', 'grvMonthlyTrend', 'grvWeeklyTrend', 'grvNetBacklogTrend',
      'grvStatusDistribution', 'grvByCategory', 'grvCategoryResolution', 'grvResolutionRateByRegion',
      'grvSlaRisk', 'grvPendingDuplicates', 'grvOldestOpen',
      'grvFilterRegions', 'grvFilterCategories',
    ],
  },
]

const SERVICE_BY_CHART = new Map<string, DashboardService>(
  DASHBOARD_SERVICES.flatMap(service => service.charts.map(chart => [chart, service] as const))
)

export const DASHBOARD_CACHE_TTL_MS = Math.max(60, Number(process.env.DASHBOARD_CACHE_TTL_SECONDS) || 900) * 1000

interface FetchContext {
  service: DashboardService
  chartName: string
  filters: Partial<ChartFilters>
  params: Record<string, string>
}

function serviceUrl(service: DashboardService): string | undefined {
  const value = process.env[service.urlEnv]
  return value ? value.replace(/\/$/, '') : undefined
}

const DEFAULT_CHARTS_PATH = '/api/v1/charts'

function chartsPath(service: DashboardService): string {
  const value = service.pathEnv ? process.env[service.pathEnv]?.trim().replace(/\/+$/, '') : undefined
  if (!value) return DEFAULT_CHARTS_PATH
  return value.startsWith('/') ? value : `/${value}`
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
    const { service, chartName, filters, params } = context
    try {
      const base = serviceUrl(service)
      if (!base) {
        throw new Error(`${service.urlEnv} is not set`)
      }
      const root = `${base}${chartsPath(service)}`
      const call: ServiceCall = (serviceChart, query) => fetchRows(root, serviceChart, query)
      return service.adapter
        ? await service.adapter.rows(chartName, filters, call)
        : await call(chartName, params)
    } catch (error) {
      // Rethrown, not returned: a failure must never be cached as data. Logged
      // here because a failed background refresh is otherwise silent.
      console.warn(`[dashboard-services] ${service.id}/${chartName} refresh failed:`, error instanceof Error ? error.message : error)
      throw error
    }
  },
})

async function fetchRows(root: string, chartName: string, params: Record<string, string>): Promise<Rows> {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${root}/${encodeURIComponent(chartName)}${query ? `?${query}` : ''}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`${chartName} returned ${res.status}`)
  }
  const body: unknown = await res.json()
  if (Array.isArray(body)) return body as Rows
  const data = (body as { data?: unknown } | null)?.data
  if (Array.isArray(data)) return data as Rows
  throw new Error(`${chartName} returned no rows`)
}

// Next bundles instrumentation.ts (which warms the cache) separately from the
// route handlers (which read it), so a module-level instance would exist twice.
// Keep one per process on globalThis.
const holder = globalThis as typeof globalThis & { __dashboardServiceCache?: ReturnType<typeof createCache> }
const cache = (holder.__dashboardServiceCache ??= createCache())

/** Whether the service with this id is declared and has its URL variable set. */
export function serviceConfigured(id: string): boolean {
  const service = DASHBOARD_SERVICES.find(s => s.id === id)
  return service !== undefined && serviceUrl(service) !== undefined
}

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
    context: { service, chartName, filters, params },
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
