// server/a2c-service.ts
//
// Adapter between the Access to Credit dashboard and the A2C platform's chart
// API (see DASHBOARD_SERVICES in ./dashboard-services).
//
// A2C keeps each farmer's region and woreda as the names the farmer registry
// sent, and has no zone. The dashboard works in the boundary P-codes the map
// draws. This module translates both ways:
//
// - Filters: a selected region, zone or woreda code becomes the A2C names that
//   resolve to it, taken from the service's own list of places, so spelling
//   differences can never hide records. A zone is sent as its woredas.
// - Rows: names are resolved to boundary units, zone series are rolled up from
//   woredas, and the location filter options gain their codes.
//
// Names are matched case- and punctuation-insensitively, and a woreda within
// its region, because woreda names repeat across the country. A place that does
// not resolve keeps its row without a code: the map skips it and the filter
// options leave it out.
import type { ChartFilters } from '@/lib/chart-queries'
import { getBoundaries, type AdminUnit, type Woreda, type Zone } from './boundaries'
import type { Rows, ServiceAdapter, ServiceCall } from './dashboard-services'

interface Place {
  regionName: string
  woredaName: string
  farmers: number
  region?: AdminUnit
  woreda?: Woreda
}

interface GeoIndex {
  zoneByCode: Map<string, Zone>
  resolveRegion(name: string): AdminUnit | undefined
  resolveWoreda(region: AdminUnit | undefined, name: string): Woreda | undefined
}

// Sent when a selected unit has no A2C names: it matches nothing, as it should.
const NO_MATCH = '-'

const norm = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(region|regional state|national regional state|city administration|zone|woreda)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toNumber = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const holder = globalThis as typeof globalThis & { __a2cGeoIndex?: Promise<GeoIndex> }

function geoIndex(): Promise<GeoIndex> {
  holder.__a2cGeoIndex ??= getBoundaries()
    .then(({ regions, zones, woredas }) => {
      const regionByName = new Map(regions.map(r => [norm(r.name), r] as const))
      const woredaByRegionAndName = new Map(woredas.map(w => [`${w.region}|${norm(w.name)}`, w] as const))
      const woredasByName = new Map<string, Woreda[]>()
      for (const w of woredas) {
        const key = norm(w.name)
        woredasByName.set(key, [...(woredasByName.get(key) ?? []), w])
      }
      return {
        zoneByCode: new Map(zones.map(z => [z.code, z] as const)),
        resolveRegion: name => regionByName.get(norm(name)),
        resolveWoreda: (region, name) => {
          if (region) return woredaByRegionAndName.get(`${region.code}|${norm(name)}`)
          // Without a region, only a name that is unique nationally is safe.
          const matches = woredasByName.get(norm(name)) ?? []
          return matches.length === 1 ? matches[0] : undefined
        },
      } satisfies GeoIndex
    })
    .catch(error => {
      holder.__a2cGeoIndex = undefined
      throw error
    })
  return holder.__a2cGeoIndex
}

// The service's list of places changes only as farmers enrol, and every filtered
// chart needs it, so it is shared across calls for a few minutes.
const PLACES_TTL_MS = 5 * 60 * 1000
let placesCache: { at: number; value: Promise<Place[]> } | undefined

async function places(call: ServiceCall): Promise<Place[]> {
  if (!placesCache || Date.now() - placesCache.at > PLACES_TTL_MS) {
    const value = Promise.all([call('a2cFilterLocations', {}), geoIndex()]).then(([rows, geo]) =>
      rows.map(row => {
        const regionName = String(row.region_name ?? '')
        const woredaName = String(row.woreda_name ?? '')
        const region = geo.resolveRegion(regionName)
        return {
          regionName,
          woredaName,
          farmers: toNumber(row.farmers),
          region,
          woreda: woredaName ? geo.resolveWoreda(region, woredaName) : undefined,
        }
      })
    )
    value.catch(() => {
      placesCache = undefined
    })
    placesCache = { at: Date.now(), value }
  }
  return placesCache.value
}

const selected = (value: string | undefined): string | undefined =>
  value && value !== 'all' ? value : undefined

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

async function serviceParams(filters: Partial<ChartFilters>, call: ServiceCall): Promise<Record<string, string>> {
  const params: Record<string, string> = {}
  const provider = selected(filters.provider)
  if (provider) params.provider = provider

  const woreda = selected(filters.woreda)
  const zone = selected(filters.zone)
  const region = selected(filters.region)
  if (!woreda && !zone && !region) return params

  const all = await places(call)
  // The most specific selection decides; the cascade keeps the others consistent.
  const inScope = all.filter(p =>
    woreda ? p.woreda?.code === woreda : zone ? p.woreda?.zone === zone : p.region?.code === region
  )
  params.region = unique(inScope.map(p => p.regionName)).join(',') || NO_MATCH
  if (woreda || zone) {
    params.woreda = unique(inScope.map(p => p.woredaName)).join(',') || NO_MATCH
  }
  return params
}

type Level = 'region' | 'zone' | 'woreda'

/** The map series: approved loan value per boundary unit, in a column named `farmers`. */
async function loansBy(level: Level, call: ServiceCall, params: Record<string, string>): Promise<Rows> {
  const geo = await geoIndex()
  const rows = await call(level === 'region' ? 'a2cLoansByRegion' : 'a2cLoansByWoreda', params)
  const totals = new Map<string, { name: string; code: string; farmers: number }>()
  for (const row of rows) {
    const region = geo.resolveRegion(String(row.region ?? ''))
    let unit: AdminUnit | undefined = region
    if (level !== 'region') {
      const woreda = geo.resolveWoreda(region, String(row.woreda ?? ''))
      unit = level === 'zone' ? (woreda && geo.zoneByCode.get(woreda.zone)) : woreda
    }
    const fallback = String((level === 'region' ? row.region : row.woreda) ?? '')
    const key = unit?.code || `name:${fallback}`
    const entry = totals.get(key) ?? { name: unit?.name || fallback, code: unit?.code || '', farmers: 0 }
    entry.farmers += toNumber(row.farmers)
    totals.set(key, entry)
  }
  return Array.from(totals.values())
    .filter(t => level !== 'zone' || t.code)
    .sort((a, b) => b.farmers - a.farmers)
    .map(t => ({ [level]: t.name, [`${level}_code`]: t.code || null, farmers: t.farmers }))
}

async function locationSummary(call: ServiceCall, params: Record<string, string>): Promise<Rows> {
  const geo = await geoIndex()
  const rows = await call('a2cLocationSummary', params)
  return rows.map(row => {
    const region = geo.resolveRegion(String(row.region ?? ''))
    const woreda = geo.resolveWoreda(region, String(row.woreda ?? ''))
    const zone = woreda ? geo.zoneByCode.get(woreda.zone) : undefined
    return {
      ...row,
      region: region?.name ?? row.region,
      zone: zone?.name ?? '',
      zone_code: zone?.code ?? null,
      woreda: woreda?.name ?? row.woreda,
      woreda_code: woreda?.code ?? null,
    }
  })
}

/** Filter options: every resolved woreda A2C reaches, with its region and zone. */
async function filterLocations(call: ServiceCall): Promise<Rows> {
  const geo = await geoIndex()
  const byWoreda = new Map<string, Record<string, unknown>>()
  for (const place of await places(call)) {
    const { region, woreda } = place
    const zone = woreda ? geo.zoneByCode.get(woreda.zone) : undefined
    if (!region || !woreda || !zone) continue
    const entry = byWoreda.get(woreda.code) ?? {
      region_name: region.name,
      region_pcode: region.code,
      zone_name: zone.name,
      zone_pcode: zone.code,
      woreda_name: woreda.name,
      woreda_pcode: woreda.code,
      farmers: 0,
    }
    entry.farmers = toNumber(entry.farmers) + place.farmers
    byWoreda.set(woreda.code, entry)
  }
  return Array.from(byWoreda.values()).sort(
    (a, b) =>
      String(a.region_name).localeCompare(String(b.region_name)) ||
      String(a.zone_name).localeCompare(String(b.zone_name)) ||
      String(a.woreda_name).localeCompare(String(b.woreda_name))
  )
}

export const a2cAdapter: ServiceAdapter = {
  async rows(chartName, filters, call) {
    switch (chartName) {
      case 'a2cFilterLocations':
        return filterLocations(call)
      case 'a2cFilterProviders':
        return call(chartName, {})
      // A2C records stop at woreda; the map still asks for a kebele series.
      case 'a2cLoansByKebele':
        return []
    }
    const params = await serviceParams(filters, call)
    switch (chartName) {
      case 'a2cLoansByRegion':
        return loansBy('region', call, params)
      case 'a2cLoansByZone':
        return loansBy('zone', call, params)
      case 'a2cLoansByWoreda':
        return loansBy('woreda', call, params)
      case 'a2cLocationSummary':
        return locationSummary(call, params)
      default:
        return call(chartName, params)
    }
  },
}
