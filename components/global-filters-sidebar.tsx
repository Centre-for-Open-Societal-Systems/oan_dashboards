"use client"

import type { A2CFilters, A2COptions } from "@/hooks/use-a2c-filters"
import { a2cRegionOptions, a2cZoneOptions, a2cWoredaOptions } from "@/hooks/use-a2c-filters"
import type { GrievanceFilters, GrievanceOptions } from "@/hooks/use-grievance-filters"

export type DashboardType = "a2c" | "grievance"

function Filter({ label, value, options, onChange }: {
  label: string; value: string; options: { code: string; name: string }[]; onChange: (value: string) => void
}) {
  return <label className="grid gap-2 text-sm font-medium">{label}
    <select className="rounded-lg border bg-white p-2" value={value} onChange={event => onChange(event.target.value)}>
      <option value="all">All</option>
      {options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
    </select>
  </label>
}

export function GlobalFiltersSidebar({ dashboardType, availableDashboards, onDashboardChange,
  a2cFilters, a2cOptions, onA2CFilterChange, grievanceFilters, grievanceOptions, onGrievanceFilterChange,
}: {
  dashboardType: DashboardType; availableDashboards: DashboardType[]; onDashboardChange: (value: DashboardType) => void
  a2cFilters: A2CFilters; a2cOptions: A2COptions; onA2CFilterChange: (key: keyof A2CFilters, value: string) => void
  grievanceFilters: GrievanceFilters; grievanceOptions: GrievanceOptions
  onGrievanceFilterChange: (key: keyof GrievanceFilters, value: string) => void
}) {
  return <aside className="w-full shrink-0 space-y-5 rounded-xl border bg-white p-5 md:w-64">
    <label className="grid gap-2 text-sm font-semibold">Dashboard
      <select className="rounded-lg border p-2" value={dashboardType} onChange={event => onDashboardChange(event.target.value as DashboardType)}>
        {availableDashboards.map(value => <option key={value} value={value}>{value === "a2c" ? "Access to Credit" : "Grievance Redress"}</option>)}
      </select>
    </label>
    {dashboardType === "a2c" ? <>
      <Filter label="Provider" value={a2cFilters.provider} options={a2cOptions.providers.map(item => ({ code: item.id, name: item.name }))} onChange={value => onA2CFilterChange("provider", value)} />
      <Filter label="Region" value={a2cFilters.region} options={a2cRegionOptions(a2cOptions.locations)} onChange={value => onA2CFilterChange("region", value)} />
      <Filter label="Zone" value={a2cFilters.zone} options={a2cZoneOptions(a2cOptions.locations, a2cFilters.region)} onChange={value => onA2CFilterChange("zone", value)} />
      <Filter label="Woreda" value={a2cFilters.woreda} options={a2cWoredaOptions(a2cOptions.locations, a2cFilters.region, a2cFilters.zone)} onChange={value => onA2CFilterChange("woreda", value)} />
    </> : <>
      <Filter label="Region" value={grievanceFilters.region} options={grievanceOptions.regions} onChange={value => onGrievanceFilterChange("region", value)} />
      <Filter label="Category" value={grievanceFilters.category} options={grievanceOptions.categories.map(item => ({ code: item.name, name: item.name }))} onChange={value => onGrievanceFilterChange("category", value)} />
    </>}
  </aside>
}
