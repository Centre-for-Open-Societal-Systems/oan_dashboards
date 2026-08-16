"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Download, Menu, X, Camera } from "lucide-react"
import { GlobalFiltersSidebar, type DashboardType } from "@/components/global-filters-sidebar"
import {
  EMPTY_A2C_FILTERS,
  a2cFilterChips,
  applyA2CFilterChange,
  useA2CFilterOptions,
  type A2CFilters,
} from "@/hooks/use-a2c-filters"
import dynamic from "next/dynamic"
import { DashboardSectionSkeleton } from "@/components/ui/dashboard-skeleton"

export default function DashboardClient({ 
  geoJsonData, 
  initialFilters,
}: { 
  geoJsonData: any;
  initialFilters?: {
    region: string;
    zone: string;
    woreda: string;
    kebele: string;
    farmerType: string;
    recordState: string;
    farmingType: string;
  };
}) {
  const [filters, setFilters] = useState(initialFilters || {
    region: 'all',
    zone: 'all', 
    woreda: 'all',
    kebele: 'all',
    farmerType: 'all',
    recordState: 'all',
    farmingType: 'all', 
  })

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  const [dashboardType, setDashboardType] = useState<DashboardType>('registries')
  const isCatalogs = dashboardType === 'catalogs'
  const isA2C = dashboardType === 'a2c'
  const isDevOps = dashboardType === 'devops'
  // Catalogues and DevOps ignore the filters entirely; A2C keeps its own set,
  // since it is scoped by lender and by its own location codes.
  const isRegistries = dashboardType === 'registries'

  const [a2cFilters, setA2CFilters] = useState<A2CFilters>(EMPTY_A2C_FILTERS)
  const { options: a2cOptions } = useA2CFilterOptions(isA2C)

  // Crop and livestock farming swap the overview for a dedicated registry view.
  const registryView: 'crop' | 'livestock' | null =
    !isRegistries ? null : filters.farmingType === 'crop' ? 'crop' : filters.farmingType === 'livestock' ? 'livestock' : null
  const [regionsLookup, setRegionsLookup] = useState<Map<string, { name: string; id: number }>>(new Map())
  const [zonesLookup, setZonesLookup] = useState<Map<string, { name: string; id: number; regionId?: number }>>(new Map())
  const [woredasLookup, setWoredasLookup] = useState<Map<string, { name: string; id: number; zoneId?: number }>>(new Map())

  const setFiltersIfChanged = useCallback((updater: (prev: typeof filters) => typeof filters) => {
    setFilters(prev => {
      const next = updater(prev)
      // shallow compare to avoid rerenders when nothing actually changed
      const changed = Object.keys(prev).some(key => (prev as any)[key] !== (next as any)[key])
      return changed ? next : prev
    })
  }, [])

  const handleMapFilterChange = useCallback((mapFilters: { region?: string; zone?: string; woreda?: string; kebele?: string; farmerType?: string; recordState?: string; farmingType?: string }) => {
    setFiltersIfChanged(prev => ({
      ...prev,
      region: mapFilters.region ?? prev.region ?? 'all',
      zone: mapFilters.zone ?? prev.zone ?? 'all',
      woreda: mapFilters.woreda ?? prev.woreda ?? 'all',
      kebele: mapFilters.kebele ?? prev.kebele ?? 'all',
      farmerType: mapFilters.farmerType ?? prev.farmerType,
      recordState: mapFilters.recordState ?? prev.recordState,
      farmingType: mapFilters.farmingType ?? prev.farmingType,
    }))
  }, [setFiltersIfChanged])

  // Drilling into the loan heat map moves the A2C location filters, so the
  // sidebar, the chips and the panels all follow the map.
  const handleA2CMapFilterChange = useCallback(
    (mapFilters: { region?: string; zone?: string; woreda?: string }) => {
      setA2CFilters(prev => {
        const next = {
          ...prev,
          region: mapFilters.region ?? 'all',
          zone: mapFilters.zone ?? 'all',
          woreda: mapFilters.woreda ?? 'all',
        }
        const changed = Object.keys(next).some(key => (prev as any)[key] !== (next as any)[key])
        return changed ? next : prev
      })
    },
    []
  )

  const a2cChips = useMemo(() => a2cFilterChips(a2cFilters, a2cOptions), [a2cFilters, a2cOptions])

  const clearA2CFilter = useCallback((key: keyof A2CFilters) => {
    setA2CFilters(prev => applyA2CFilterChange(prev, key, 'all'))
  }, [])

  // Load region lookup once for name resolution in header tags
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch('/api/filter-options')
        if (!res.ok) return
        const data = await res.json()
        const map = new Map<string, { name: string; id: number }>()
        ;(data?.regions || []).forEach((r: any, idx: number) => {
          if (!r?.code) return
          map.set(r.code, { name: r.name || r.code, id: r.id || idx + 1 })
        })
        setRegionsLookup(map)
      } catch (err) {
        // ignore
      }
    }
    fetchRegions()
  }, [])

  // When region changes, ensure zones lookup is populated for that region code if missing
  useEffect(() => {
    const loadZones = async () => {
      if (filters.region === 'all') return
      // If we already have zones for this region, skip
      if (Array.from(zonesLookup.values()).some(z => z.regionId === regionsLookup.get(filters.region)?.id)) return
      const regionMeta = regionsLookup.get(filters.region)
      const regionParam = regionMeta?.id || filters.region
      try {
        const res = await fetch(`/api/locations?regionId=${encodeURIComponent(regionParam)}`)
        if (!res.ok) return
        const data = await res.json()
        const next = new Map(zonesLookup)
        ;(data?.zones || []).forEach((z: any, idx: number) => {
          if (!z?.code) return
          next.set(z.code, { name: z.name || z.code, id: z.id || idx + 1, regionId: regionMeta?.id })
        })
        setZonesLookup(next)
      } catch (err) {
        // ignore
      }
    }
    loadZones()
  }, [filters.region, regionsLookup, zonesLookup])

  // When zone changes, ensure woredas lookup is populated for that zone code if missing
  useEffect(() => {
    const loadWoredas = async () => {
      if (filters.zone === 'all') return
      const zoneMeta = zonesLookup.get(filters.zone)
      // If we already have woredas for this zone, skip
      if (zoneMeta && Array.from(woredasLookup.values()).some(w => w.zoneId === zoneMeta.id)) return
      const zoneParam = zoneMeta?.id || filters.zone
      try {
        const res = await fetch(`/api/locations?zoneId=${encodeURIComponent(zoneParam)}`)
        if (!res.ok) return
        const data = await res.json()
        const next = new Map(woredasLookup)
        ;(data?.woredas || []).forEach((w: any, idx: number) => {
          if (!w?.code) return
          next.set(w.code, { name: w.name || w.code, id: w.id || idx + 1, zoneId: zoneMeta?.id })
        })
        setWoredasLookup(next)
      } catch (err) {
        // ignore
      }
    }
    loadWoredas()
  }, [filters.zone, zonesLookup, woredasLookup])



  const captureElementById = useCallback(async (id: string, prefix: string) => {
    try {
      const target = document.getElementById(id)
      if (!target) return
      const { toPng } = await import("html-to-image")

      // Hide KPI elements if present to capture only charts
      const hidden: Array<{ el: HTMLElement; prev: string }> = []
      target.querySelectorAll<HTMLElement>('[data-kpi="true"], [data-export-control="true"]').forEach(el => {
        hidden.push({ el, prev: el.style.display })
        el.style.display = 'none'
      })

      const dataUrl = await toPng(target, { cacheBust: true })

      // Restore hidden elements
      hidden.forEach(({ el, prev }) => { el.style.display = prev })

      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${prefix}-${new Date().toISOString().split("T")[0]}.png`
      link.click()
    } catch (err) {
      console.error("Capture failed", err)
    }
  }, [])

  const handleScreenshot = async () => {
    await captureElementById("dashboard-root", "dashboard")
  }

  const handleExport = async (format: "csv" | "excel") => {
    try {
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `ati_fp_dashboard-${timestamp}.${format === "csv" ? "csv" : "xlsx"}`

      // Create a temporary link to download the data
      const response = await fetch('/api/data/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          format,
          filename
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Display active filters with proper names
  const activeFilterItems = useMemo(() => {
    const filterItems: Array<{ key: string; label: string; value: string }> = [];

    // Location filters - use lookup names, fall back to codes
    if (filters.region !== 'all') {
      const regionName = regionsLookup.get(filters.region)?.name || filters.region
      filterItems.push({ key: 'region', label: 'Region', value: regionName });
    }
    
    if (filters.zone !== 'all') {
      const zoneName = zonesLookup.get(filters.zone)?.name || filters.zone
      filterItems.push({ key: 'zone', label: 'Zone', value: zoneName });
    }
    
    if (filters.woreda !== 'all') {
      const woredaName = woredasLookup.get(filters.woreda)?.name || filters.woreda
      filterItems.push({ key: 'woreda', label: 'Woreda', value: woredaName });
    }
    
    // Other filters
    if (filters.kebele !== 'all') {
      filterItems.push({ key: 'kebele', label: 'Kebele', value: filters.kebele });
    }
    if (filters.farmerType !== 'all') {
      filterItems.push({ key: 'farmerType', label: 'Type of Farmer', value: filters.farmerType });
    }
    if (filters.recordState !== 'all') {
      filterItems.push({ key: 'recordState', label: 'Record State', value: filters.recordState });
    }
    if (filters.farmingType !== 'all') {
      filterItems.push({ key: 'farmingType', label: 'Farming Type', value: filters.farmingType });
    }
    
    return filterItems;
  }, [filters, geoJsonData]);

  const clearFilter = useCallback((filterKey: string) => {
    setFiltersIfChanged(prev => {
      const next = { ...prev };

      // Clear the requested filter
      next[filterKey as keyof typeof prev] = 'all';

      // Cascade clears for dependent children to keep sidebar/dropdowns/map in sync
      if (filterKey === 'region') {
        next.zone = 'all';
        next.woreda = 'all';
        next.kebele = 'all';
      }
      if (filterKey === 'zone') {
        next.woreda = 'all';
        next.kebele = 'all';
      }
      if (filterKey === 'woreda') {
        next.kebele = 'all';
      }

      return next;
    })
  }, [setFiltersIfChanged]);

  return (
    <div id="dashboard-root" className="animate-page-fade max-h-screen overflow-hidden bg-background text-foreground flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Full Width Header */}
      <div className="w-full relative overflow-hidden bg-[#01215A] text-white py-1 px-4 md:px-6 flex-shrink-0 z-10 shadow-sm">
        {/* Decorative national flag; its hoist edge fades into the ribbon. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-[240px] bg-[url('/images/ethiopia-flag-wave.svg')] bg-right bg-no-repeat opacity-95 md:block"
          style={{ backgroundSize: 'auto 100%' }}
        />

        {/* Right padding keeps the controls clear of the flag artwork. */}
        <div className="max-w-full flex items-center justify-between relative z-10 gap-4 md:pr-[110px]">
          <div className="flex items-center space-x-4">
            <img
              src="/images/ati_small.jpg"
              alt="Ministry of Finance Logo"
              className="h-10 w-10 md:h-12 rounded-full md:w-12 object-contain"
            />
            <div className="text-center md:text-left">
              <h1 className="text-lg md:text-xl font-bold text-white">Farmer Profile Dashboard</h1>
              <p className="text-white/60 text[10px] md:text-sm">Agricultural Development & Farmer Analytics</p>
            </div>
          </div>

          {/* Active Filters Display — catalogues and DevOps take no filters */}
          <div className="hidden md:flex flex-1 justify-center px-4 gap-2 flex-wrap">
            {isRegistries && activeFilterItems.map((filter) => (
              <div
                key={filter.key}
                className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20 flex items-center gap-2"
              >
                <span>{filter.label}: {filter.value}</span>
                <button
                  onClick={() => clearFilter(filter.key)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  aria-label={`Clear ${filter.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {isA2C && a2cChips.map((chip) => (
              <div
                key={chip.key}
                className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium text-white border border-white/20 flex items-center gap-2"
              >
                <span>{chip.label}: {chip.value}</span>
                <button
                  onClick={() => clearA2CFilter(chip.key)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  aria-label={`Clear ${chip.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-2">
           
            {/* <Button
              variant="outline"
              size="sm"
              onClick={handleScreenshot}
              className="hidden md:inline-flex"
            >
              <Camera className="h-4 w-4 mr-2" />
              Save Shot
            </Button> */}

            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-[#01215A]/80 text-white backdrop-blur-sm hover:bg-[#01215A] hover:text-white"
              onClick={() =>
                isCatalogs
                  ? captureElementById('dashboard-catalogs', 'catalogs')
                  : isA2C
                    ? captureElementById('dashboard-a2c', 'a2c-access-to-credit')
                    : isDevOps
                      ? captureElementById('dashboard-devops', 'devops-infrastructure')
                      : registryView
                        ? captureElementById(`tab-content-${registryView}-registry`, `${registryView}-registry`)
                        : captureElementById('dashboard-overview', 'farmer-overview')
              }
            >
              <Camera className="h-4 w-4" />
       
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 max-h-screen">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0 transition-all duration-300 ease-in-out border-r border-[#0A2A66] bg-gradient-to-b from-[#00134B] to-[#001042] relative h-full`}>
          <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 h-full max-h-full overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`}>
            <GlobalFiltersSidebar
              filters={filters}
              onFiltersChange={setFilters}
              isSidebarOpen={isSidebarOpen}
              onSidebarToggle={toggleSidebar}
              dashboardType={dashboardType}
              onDashboardTypeChange={setDashboardType}
              a2cFilters={a2cFilters}
              onA2CFiltersChange={setA2CFilters}
            />
          </div>

          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute ${isSidebarOpen ? '-right-3' : 'left-2'} top-4 z-50 bg-[#076E7D] text-white rounded-full p-1.5 shadow-lg hover:bg-[#0A8496] transition-all duration-300`}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Main Content */}
        <div
          // Prefer a no-scroll screen on typical laptop heights; fall back to
          // scrolling on shorter viewports so panels are never clipped.
          className="@container flex-1 min-h-0 bg-[#F5F8F6] p-3 md:p-4 overflow-y-auto xl:overflow-hidden"
        >
          {isCatalogs ? (
            <div id="dashboard-catalogs" className="h-full min-h-0">
              <CatalogsDashboard />
            </div>
          ) : isA2C ? (
            <div id="dashboard-a2c" className="h-full min-h-0">
              <A2CDashboard
                filters={a2cFilters}
                geoJsonData={geoJsonData}
                onMapFilterChange={handleA2CMapFilterChange}
              />
            </div>
          ) : isDevOps ? (
            <div id="dashboard-devops" className="h-full min-h-0">
              <DevOpsDashboard />
            </div>
          ) : registryView === 'crop' ? (
            <div id="tab-content-crop-registry" className="h-full min-h-0">
              <CropSownDashboard
                filters={filters}
                geoJsonData={geoJsonData}
                onMapFilterChange={handleMapFilterChange}
              />
            </div>
          ) : registryView === 'livestock' ? (
            <div id="tab-content-livestock-registry" className="h-full min-h-0">
              <LivestockDashboard
                filters={filters}
                geoJsonData={geoJsonData}
                onMapFilterChange={handleMapFilterChange}
              />
            </div>
          ) : (
            <div id="dashboard-overview" className="h-full min-h-0">
              <FarmerOverviewDashboard
                filters={filters}
                geoJsonData={geoJsonData}
                onMapFilterChange={handleMapFilterChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
const FarmerOverviewDashboard = dynamic(
  () => import("@/components/farmer-overview-dashboard").then(mod => mod.FarmerOverviewDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

const CropSownDashboard = dynamic(
  () => import("@/components/crop-sown-dashboard").then(mod => mod.CropSownDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

const LivestockDashboard = dynamic(
  () => import("@/components/livestock-dashboard").then(mod => mod.LivestockDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

const CatalogsDashboard = dynamic(
  () => import("@/components/catalogs-dashboard").then(mod => mod.CatalogsDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

const A2CDashboard = dynamic(
  () => import("@/components/a2c-dashboard").then(mod => mod.A2CDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

const DevOpsDashboard = dynamic(
  () => import("@/components/devops-dashboard").then(mod => mod.DevOpsDashboard),
  { ssr: false, loading: () => <TabSkeleton /> }
)

function TabSkeleton() {
  return (
    <DashboardSectionSkeleton />
  )
}
