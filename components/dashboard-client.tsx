"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { GlobalFiltersSidebar, type DashboardType } from "./global-filters-sidebar"
import { useDeploymentConfig } from "@/hooks/use-deployment-config"
import { EMPTY_A2C_FILTERS, applyA2CFilterChange, useA2CFilterOptions } from "@/hooks/use-a2c-filters"
import { EMPTY_GRIEVANCE_FILTERS, useGrievanceFilterOptions } from "@/hooks/use-grievance-filters"

const A2CDashboard = dynamic(() => import("./a2c-dashboard").then(module => module.A2CDashboard), { ssr: false })
const GrievanceDashboard = dynamic(() => import("./grievance-dashboard").then(module => module.GrievanceDashboard), { ssr: false })

export default function DashboardClient() {
  const { dashboards } = useDeploymentConfig()
  const [selected, setSelected] = useState<DashboardType>("a2c")
  const dashboardType = dashboards.includes(selected) ? selected : dashboards[0]
  const [a2cFilters, setA2C] = useState(EMPTY_A2C_FILTERS)
  const [grievanceFilters, setGrievance] = useState(EMPTY_GRIEVANCE_FILTERS)
  const { options: a2cOptions } = useA2CFilterOptions(dashboardType === "a2c")
  const { options: grievanceOptions } = useGrievanceFilterOptions(dashboardType === "grievance")
  return <main className="min-h-screen bg-slate-50 p-4 md:p-7">
    <header className="mb-6"><h1 className="text-2xl font-bold text-slate-900">OAN Dashboards</h1>
      <p className="text-sm text-slate-600">Access to Credit and Grievance Redress</p>
    </header>
    {!dashboardType ? <p role="status">No dashboard service is configured for this environment.</p> :
      <div className="flex flex-col items-start gap-5 md:flex-row">
        <GlobalFiltersSidebar dashboardType={dashboardType} availableDashboards={dashboards} onDashboardChange={setSelected}
          a2cFilters={a2cFilters} a2cOptions={a2cOptions} onA2CFilterChange={(key, value) => setA2C(previous => applyA2CFilterChange(previous, key, value))}
          grievanceFilters={grievanceFilters} grievanceOptions={grievanceOptions} onGrievanceFilterChange={(key, value) => setGrievance(previous => ({ ...previous, [key]: value }))} />
        <section className="min-w-0 flex-1">
          {dashboardType === "a2c" ? <A2CDashboard filters={a2cFilters} onMapFilterChange={value => setA2C(previous => ({
            ...previous, region: value.region || "all", zone: value.zone || "all", woreda: value.woreda || "all",
          }))} /> : <GrievanceDashboard filters={grievanceFilters} />}
        </section>
      </div>}
  </main>
}
