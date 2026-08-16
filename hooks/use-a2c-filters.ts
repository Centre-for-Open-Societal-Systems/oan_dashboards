"use client"

// A2C's filter contract and the option lists that back it.
//
// A2C is filtered by lender and by its own HDX P-code hierarchy, so it cannot
// reuse the registry filters (those resolve to g2p ids). Enrolment stops at
// woreda, hence no kebele level.

import { useEffect, useState } from "react"

export type A2CFilters = {
  provider: string
  region: string
  zone: string
  woreda: string
}

export const EMPTY_A2C_FILTERS: A2CFilters = {
  provider: "all",
  region: "all",
  zone: "all",
  woreda: "all",
}

export type A2CProviderOption = {
  id: string
  name: string
  status: string
}

/** One row per woreda the programme reaches; the parent levels repeat. */
export type A2CLocationRow = {
  regionName: string
  regionPcode: string
  zoneName: string
  zonePcode: string
  woredaName: string
  woredaPcode: string
}

export type A2COptions = {
  providers: A2CProviderOption[]
  locations: A2CLocationRow[]
}

const EMPTY_OPTIONS: A2COptions = { providers: [], locations: [] }

async function fetchOptions(): Promise<A2COptions> {
  const response = await fetch('/api/charts?charts=a2cFilterProviders,a2cFilterLocations')
  if (!response.ok) throw new Error(`HTTP error ${response.status}`)
  const payload = await response.json()

  const providers: A2CProviderOption[] = (payload?.data?.a2cFilterProviders?.data || [])
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      status: String(row.status),
    }))
    .filter((row: A2CProviderOption) => row.id && row.name)

  const locations: A2CLocationRow[] = (payload?.data?.a2cFilterLocations?.data || [])
    .map((row: any) => ({
      regionName: String(row.region_name),
      regionPcode: String(row.region_pcode),
      zoneName: String(row.zone_name),
      zonePcode: String(row.zone_pcode),
      woredaName: String(row.woreda_name),
      woredaPcode: String(row.woreda_pcode),
    }))
    .filter((row: A2CLocationRow) => row.regionPcode && row.zonePcode && row.woredaPcode)

  return { providers, locations }
}

// The option lists are sample reference data that never change within a session,
// and both the sidebar dropdowns and the header's filter chips need them. One
// shared promise keeps that to a single request.
let cached: Promise<A2COptions> | null = null

/**
 * @param enabled Defer the request until A2C is actually the selected dashboard.
 */
export function useA2CFilterOptions(enabled: boolean): { options: A2COptions; loading: boolean } {
  const [options, setOptions] = useState<A2COptions>(EMPTY_OPTIONS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    setLoading(true)

    if (!cached) {
      cached = fetchOptions().catch((error) => {
        // Let the next mount retry rather than caching the failure forever.
        cached = null
        throw error
      })
    }

    cached
      .then((result) => {
        if (!cancelled) setOptions(result)
      })
      .catch((error) => {
        console.error('Failed to load A2C filter options:', error)
        if (!cancelled) setOptions(EMPTY_OPTIONS)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { options, loading }
}

/** A2C's location tree repeats each parent level, so options need deduping. */
export function dedupeByCode(entries: Array<{ code: string; name: string }>) {
  const seen = new Map<string, string>()
  entries.forEach(({ code, name }) => {
    if (!seen.has(code)) seen.set(code, name)
  })
  return Array.from(seen, ([code, name]) => ({ code, name }))
}

export function a2cRegionOptions(locations: A2CLocationRow[]) {
  return dedupeByCode(locations.map((row) => ({ code: row.regionPcode, name: row.regionName })))
}

export function a2cZoneOptions(locations: A2CLocationRow[], region: string) {
  const scoped = locations.filter((row) => region === 'all' || row.regionPcode === region)
  return dedupeByCode(scoped.map((row) => ({ code: row.zonePcode, name: row.zoneName })))
}

export function a2cWoredaOptions(locations: A2CLocationRow[], region: string, zone: string) {
  const scoped = locations.filter(
    (row) =>
      (region === 'all' || row.regionPcode === region) && (zone === 'all' || row.zonePcode === zone)
  )
  return dedupeByCode(scoped.map((row) => ({ code: row.woredaPcode, name: row.woredaName })))
}

/**
 * Applies the same cascade the registry filters use: narrowing a parent
 * invalidates whichever child was selected under the old one.
 */
export function applyA2CFilterChange(
  filters: A2CFilters,
  key: keyof A2CFilters,
  value: string
): A2CFilters {
  const next = { ...filters, [key]: value }

  if (key === 'region') {
    next.zone = 'all'
    next.woreda = 'all'
  } else if (key === 'zone') {
    next.woreda = 'all'
  }

  return next
}

/** Header chips: names the selected codes so the ribbon reads in plain language. */
export function a2cFilterChips(
  filters: A2CFilters,
  options: A2COptions
): Array<{ key: keyof A2CFilters; label: string; value: string }> {
  const chips: Array<{ key: keyof A2CFilters; label: string; value: string }> = []
  const nameFor = (entries: Array<{ code: string; name: string }>, code: string) =>
    entries.find((entry) => entry.code === code)?.name || code

  if (filters.provider !== 'all') {
    const provider = options.providers.find((entry) => entry.id === filters.provider)
    chips.push({ key: 'provider', label: 'Provider', value: provider?.name || filters.provider })
  }
  if (filters.region !== 'all') {
    chips.push({
      key: 'region',
      label: 'Region',
      value: nameFor(a2cRegionOptions(options.locations), filters.region),
    })
  }
  if (filters.zone !== 'all') {
    chips.push({
      key: 'zone',
      label: 'Zone',
      value: nameFor(a2cZoneOptions(options.locations, 'all'), filters.zone),
    })
  }
  if (filters.woreda !== 'all') {
    chips.push({
      key: 'woreda',
      label: 'Woreda',
      value: nameFor(a2cWoredaOptions(options.locations, 'all', 'all'), filters.woreda),
    })
  }

  return chips
}
