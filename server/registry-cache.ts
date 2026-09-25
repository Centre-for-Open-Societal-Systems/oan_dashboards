// server/registry-cache.ts
//
// GEN2 farmer registry charts are served by farmer-registry-dashboard-api from
// materialized views the registry refreshes hourly, so the numbers are static
// between refreshes. Each chart+filter combination is fetched from the API at
// most once per TTL (default 15 min); in between, and while a refresh is in
// flight or failing, the last good rows are served.
import { LRUCache } from 'lru-cache'
import type { ChartFilters } from '@/lib/chart-queries'
import { generateCacheKey } from './cache'

// Chart IDs served by the dashboard API. Every other chart runs local SQL.
export const REGISTRY_CHARTS = [
  'farmerKpis', 'farmersByRegion', 'farmersByGender', 'farmersByType',
  'farmersByAgeAndGender', 'farmersByEducation', 'landTenureSplit',
  'registryTrendByMonth', 'registryCoverage', 'farmersByRecordState',
  'farmersByImportStatus', 'farmersByPsnpStatus',
] as const

// Only the filters the API understands. Forwarding anything else would split
// the cache into keys that all return the same rows.
const API_FILTERS = ['region', 'zone', 'woreda', 'kebele', 'farmingType', 'recordState'] as const

const TTL_MS = Math.max(60, Number(process.env.REGISTRY_CACHE_TTL_SECONDS) || 900) * 1000

// FARMER_API_BASE is server-only; the NEXT_PUBLIC_ name is still read for one
// release so existing .env files keep working.
const apiBase = () =>
  (process.env.FARMER_API_BASE || process.env.NEXT_PUBLIC_FARMER_API_BASE || 'http://localhost:8005').replace(/\/$/, '')

type Rows = Record<string, unknown>[]
interface FetchContext {
  chartName: string
  query: string
}

const createCache = () => new LRUCache<string, Rows, FetchContext>({
  max: 500,
  ttl: TTL_MS,
  // Serve stale rows while the refresh runs, and keep them if it fails.
  allowStale: true,
  noDeleteOnStaleGet: true,
  allowStaleOnFetchRejection: true,
  allowStaleOnFetchAbort: true,
  // Reads must not extend the TTL, or a popular key would never refresh.
  updateAgeOnGet: false,
  fetchMethod: async (_key, _stale, { context }) => {
    const url = `${apiBase()}/api/v1/charts/${context.chartName}${context.query ? `?${context.query}` : ''}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Dashboard API returned ${res.status} for ${context.chartName}`)
      }
      return (await res.json()) as Rows
    } catch (error) {
      // Rethrown, not returned: a failure must never be cached as data. Logged
      // here because a failed background refresh is otherwise silent.
      console.warn(`[registry-cache] refresh failed for ${context.chartName}:`, error instanceof Error ? error.message : error)
      throw error
    }
  },
})

// Next bundles instrumentation.ts (which warms the cache) separately from the
// route handlers (which read it), so a module-level instance would exist twice.
// Keep one per process on globalThis.
const holder = globalThis as typeof globalThis & { __registryChartCache?: ReturnType<typeof createCache> }
const cache = (holder.__registryChartCache ??= createCache())

export function isRegistryChart(chartName: string): boolean {
  return (REGISTRY_CHARTS as readonly string[]).includes(chartName)
}

function apiParams(filters: Partial<ChartFilters>): Record<string, string> {
  const params: Record<string, string> = {}
  for (const key of API_FILTERS) {
    const value = filters[key]
    if (value && value !== 'all') params[key] = String(value)
  }
  return params
}

export async function getRegistryChart(
  chartName: string,
  filters: Partial<ChartFilters>,
  options: { forceRefresh?: boolean } = {}
): Promise<Rows> {
  const params = apiParams(filters)
  const key = generateCacheKey(`registry:${chartName}`, params)
  const rows = await cache.fetch(key, {
    context: { chartName, query: new URLSearchParams(params).toString() },
    forceRefresh: options.forceRefresh ?? false,
  })
  if (rows === undefined) {
    throw new Error(`No data for ${chartName}`)
  }
  return rows
}

// Refreshes the unfiltered view of every registry chart, which is what the
// dashboard opens on, so first paint never waits on the API.
export async function warmRegistryCache(): Promise<void> {
  const results = await Promise.allSettled(
    REGISTRY_CHARTS.map(chartName => getRegistryChart(chartName, {}, { forceRefresh: true }))
  )
  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    console.warn(`[registry-cache] warm-up: ${failed}/${REGISTRY_CHARTS.length} charts failed; serving previous data where available`)
  }
}

export const REGISTRY_CACHE_TTL_MS = TTL_MS
