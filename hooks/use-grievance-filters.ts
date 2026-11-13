"use client"

// The grievance dashboard's filter contract and the option lists that back it.
//
// The grievance service rolls cases up by region and service category only, so
// it has no zone, woreda or kebele level and cannot reuse the registry filters.

import { useEffect, useState } from "react"

export type GrievanceFilters = {
  region: string
  category: string
}

export const EMPTY_GRIEVANCE_FILTERS: GrievanceFilters = {
  region: "all",
  category: "all",
}

export type GrievanceRegionOption = { code: string; name: string; grievances: number }
export type GrievanceCategoryOption = { name: string; grievances: number }

export type GrievanceOptions = {
  regions: GrievanceRegionOption[]
  categories: GrievanceCategoryOption[]
}

const EMPTY_OPTIONS: GrievanceOptions = { regions: [], categories: [] }

async function fetchOptions(): Promise<GrievanceOptions> {
  const response = await fetch("/api/charts?charts=grvFilterRegions,grvFilterCategories")
  if (!response.ok) throw new Error(`HTTP error ${response.status}`)
  const payload = await response.json()

  const regions: GrievanceRegionOption[] = (payload?.data?.grvFilterRegions?.data || [])
    .map((row: Record<string, unknown>) => ({
      code: String(row.region_code ?? ""),
      name: String(row.region_name ?? row.region_code ?? ""),
      grievances: Number(row.grievances) || 0,
    }))
    .filter((row: GrievanceRegionOption) => row.code)

  const categories: GrievanceCategoryOption[] = (payload?.data?.grvFilterCategories?.data || [])
    .map((row: Record<string, unknown>) => ({ name: String(row.category ?? ""), grievances: Number(row.grievances) || 0 }))
    .filter((row: GrievanceCategoryOption) => row.name)

  return { regions, categories }
}

// Regions and categories change only as grievances arrive in new places, not
// within a session, and both the sidebar and the header chips need them.
let cached: Promise<GrievanceOptions> | null = null

/**
 * @param enabled Defer the request until the grievance dashboard is actually selected.
 */
export function useGrievanceFilterOptions(enabled: boolean): { options: GrievanceOptions; loading: boolean } {
  const [result, setResult] = useState<{ options: GrievanceOptions; loaded: boolean }>({
    options: EMPTY_OPTIONS,
    loaded: false,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    if (!cached) {
      cached = fetchOptions().catch((error) => {
        // Let the next mount retry rather than caching the failure forever.
        cached = null
        throw error
      })
    }

    cached
      .then((options) => {
        if (!cancelled) setResult({ options, loaded: true })
      })
      .catch((error) => {
        console.error("Failed to load grievance filter options:", error)
        if (!cancelled) setResult({ options: EMPTY_OPTIONS, loaded: true })
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { options: result.options, loading: enabled && !result.loaded }
}

/** Header chips: names the selected codes so the ribbon reads in plain language. */
export function grievanceFilterChips(
  filters: GrievanceFilters,
  options: GrievanceOptions
): Array<{ key: keyof GrievanceFilters; label: string; value: string }> {
  const chips: Array<{ key: keyof GrievanceFilters; label: string; value: string }> = []

  if (filters.region !== "all") {
    const region = options.regions.find((entry) => entry.code === filters.region)
    chips.push({ key: "region", label: "Region", value: region?.name || filters.region })
  }
  if (filters.category !== "all") {
    chips.push({ key: "category", label: "Category", value: filters.category })
  }

  return chips
}
