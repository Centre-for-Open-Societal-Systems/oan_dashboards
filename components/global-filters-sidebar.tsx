// components/global-filters-sidebar.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import {
  EMPTY_A2C_FILTERS,
  a2cRegionOptions,
  a2cWoredaOptions,
  a2cZoneOptions,
  applyA2CFilterChange,
  useA2CFilterOptions,
  type A2CFilters,
} from "@/hooks/use-a2c-filters"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CalendarIcon } from "lucide-react"
import { timePeriods } from "@/lib/mock-data"

interface Region { id: number; name: string; code: string; }
interface Zone { id: number; name: string; code: string; region: number; }
interface Woreda { id: number; name: string; code: string; zone: number; }
interface Kebele { id: number; name: string; code: string; woreda: number; }

interface RecordStatus { status: string; count: number; }

interface FarmerType { farmer_type: string; count: number; }

export type DashboardType = "registries" | "catalogs" | "a2c" | "devops"

interface GlobalFiltersSidebarProps {
  filters: {
    region: string
    zone: string
    woreda: string
    kebele: string
    farmerType: string
    recordState: string
    farmingType: string
  }
  onFiltersChange: (filters: any) => void
  isSidebarOpen: boolean
  onSidebarToggle: () => void
  dashboardType: DashboardType
  onDashboardTypeChange: (value: DashboardType) => void
  a2cFilters: A2CFilters
  onA2CFiltersChange: (filters: A2CFilters) => void
}

export function GlobalFiltersSidebar({

  filters,

  onFiltersChange,

  dashboardType,

  onDashboardTypeChange,

  a2cFilters,

  onA2CFiltersChange,

}: GlobalFiltersSidebarProps) {

  const [isOpen, setIsOpen] = useState(false)



  const [regions, setRegions] = useState<Region[]>([])

  const [zones, setZones] = useState<Zone[]>([])

  const [woredas, setWoredas] = useState<Woreda[]>([])

  const [kebeles, setKebeles] = useState<Kebele[]>([])



  const [recordStates, setRecordStates] = useState<RecordStatus[]>([])

  const [farmerTypes, setFarmerTypes] = useState<FarmerType[]>([])

  const [isLoading, setIsLoading] = useState(true)

  const [isZonesLoading, setIsZonesLoading] = useState(false)

  const [isWoredasLoading, setIsWoredasLoading] = useState(false)

  const [isKebelesLoading, setIsKebelesLoading] = useState(false)

  const fetchJson = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed')
    return res.json()
  }

  // Load filter options from API/DB

  useEffect(() => {

    const loadFilterOptions = async () => {

      try {

        setIsLoading(true);



        // Load regions and record states from API/DB
        const filterOptions = await fetchJson('/api/filter-options');

        const regionsData = (filterOptions?.regions || [])
          .map((region: any, index: number) => ({
            id: region.id || index + 1,
            name: region.name,
            code: region.code || region.name,
          }))
          .filter((region: any) => region.name && region.code);

        const recordStatesDataRaw = (filterOptions?.recordStatuses || []).map((item: any) => ({
          status: item.status,
          count: item.count,
        }));
        const fallbackRecordStates = [
          { status: 'draft', count: 0 },
          { status: 'approved', count: 0 },
          { status: 'pending', count: 0 },
        ];
        const recordStatesData = recordStatesDataRaw.length > 0 ? recordStatesDataRaw : fallbackRecordStates;

        const farmerTypesData = (filterOptions?.farmerTypes || [])
          .map((item: any) => ({
            farmer_type: item.farmer_type,
            count: Number(item.count) || 0,
          }))
          .filter((item: FarmerType) => item.farmer_type);



        setRegions(regionsData);

        setRecordStates(recordStatesData);

        setFarmerTypes(farmerTypesData);

      } catch (error) {

        console.error('Failed to load filter options:', error);

        setRegions([]);

        setRecordStates([]);

        setFarmerTypes([]);

      } finally {

        setIsLoading(false);

      }

    };



    loadFilterOptions();

  }, []);



  // --- 3. CASCADING EFFECT: Load Zones when Region changes ---

  useEffect(() => {

    if (!filters.region || filters.region === "all") {

      setZones([]) // Clear zones if no region is selected

      return

    }



    const loadZones = async () => {

      try {

        setIsZonesLoading(true);



        const regionMatch = regions.find(
          (r) => r.code === filters.region || String(r.id) === filters.region
        )
        const regionParam = regionMatch?.id ?? filters.region

        // Load zones for the selected region from API/DB
        const zonesResponse = await fetchJson(`/api/locations?regionId=${encodeURIComponent(regionParam)}`)

        const zonesData = (zonesResponse?.zones || [])
          .map((zone: any, index: number) => ({
            id: zone.id || index + 1,
            name: zone.name,
            code: zone.code || zone.name,
            region: filters.region
          }))
          .filter((zone: any) => zone.name && zone.code);



        setZones(zonesData);

      } catch (error) {

        console.error('Failed to load zones:', error);

        setZones([]);

      } finally {

        setIsZonesLoading(false);

      }

    };



    loadZones();

  }, [filters.region, regions]);



  // --- 4. CASCADING EFFECT: Load Woredas when Zone changes ---

  useEffect(() => {

    if (!filters.zone || filters.zone === "all") {

      setWoredas([])

      return

    }



    const loadWoredas = async () => {

      try {

        setIsWoredasLoading(true);



        const zoneMatch = zones.find(
          (z) => z.code === filters.zone || String(z.id) === filters.zone
        )
        const zoneParam = zoneMatch?.id ?? filters.zone

        // Load woredas for the selected zone from API/DB
        const woredasResponse = await fetchJson(`/api/locations?zoneId=${encodeURIComponent(zoneParam)}`)

        const woredasData = (woredasResponse?.woredas || [])
          .map((woreda: any, index: number) => ({
            id: woreda.id || index + 1,
            name: woreda.name,
            code: woreda.code || woreda.name,
            zone: filters.zone
          }))
          .filter((woreda: any) => woreda.name && woreda.code);



        setWoredas(woredasData);

      } catch (error) {

        console.error('Failed to load woredas:', error);

        setWoredas([]);

      } finally {

        setIsWoredasLoading(false);

      }

    };



    loadWoredas();

  }, [filters.zone, zones]);



  // --- 5. CASCADING EFFECT: Load Kebeles when Woreda changes ---

  useEffect(() => {

    if (!filters.woreda || filters.woreda === "all") {

      setKebeles([])

      return

    }



    const loadKebeles = async () => {
      try {
        setIsKebelesLoading(true)
        const woredaMatch = woredas.find(
          (w) => w.code === filters.woreda || String(w.id) === filters.woreda
        )
        const woredaParam = woredaMatch?.id ?? filters.woreda

        const kebelesResponse = await fetchJson(`/api/locations?woredaId=${encodeURIComponent(woredaParam)}`)

        const kebelesData = (kebelesResponse?.kebeles || []).map((kebele: any, index: number) => ({
          id: kebele.id || index + 1,
          name: kebele.name,
          code: kebele.code || kebele.name,
          woreda: filters.woreda,
        }))

        setKebeles(kebelesData)
      } catch (error) {
        console.error('Failed to load kebeles:', error)
        setKebeles([])
      } finally {
        setIsKebelesLoading(false)
      }
    }

    loadKebeles()

  }, [filters.woreda, woredas]);



  // A2C's lender list and location tree are small enough to arrive together and
  // cascade locally, so they skip the /api/locations round trips above.
  const isA2C = dashboardType === "a2c"
  const { options: a2cOptions, loading: isA2COptionsLoading } = useA2CFilterOptions(isA2C)

  const a2cRegions = useMemo(() => a2cRegionOptions(a2cOptions.locations), [a2cOptions.locations])

  const a2cZones = useMemo(
    () => a2cZoneOptions(a2cOptions.locations, a2cFilters.region),
    [a2cOptions.locations, a2cFilters.region]
  )

  const a2cWoredas = useMemo(
    () => a2cWoredaOptions(a2cOptions.locations, a2cFilters.region, a2cFilters.zone),
    [a2cOptions.locations, a2cFilters.region, a2cFilters.zone]
  )

  const handleA2CFilterChange = (key: keyof A2CFilters, value: string) => {
    onA2CFiltersChange(applyA2CFilterChange(a2cFilters, key, value))
  }

  const handleFilterChange = (key: keyof GlobalFiltersSidebarProps['filters'], value: any) => {

    const newFilters = { ...filters, [key]: value }



    // Reset dependent filters when parent filter changes

    if (key === "region") {

      newFilters.zone = "all";

      newFilters.woreda = "all";

      newFilters.kebele = "all";

      setZones([]); setWoredas([]); setKebeles([]);

    } else if (key === "zone") {

      newFilters.woreda = "all";

      newFilters.kebele = "all";

      setWoredas([]); setKebeles([]);

    } else if (key === "woreda") {

      newFilters.kebele = "all";

      setKebeles([]);

    }




    onFiltersChange(newFilters)

  }



  const clearAllFilters = () => {

    const clearedFilters = {

      region: "all",

      zone: "all",

      woreda: "all",

      kebele: "all",

      farmerType: "all",

      recordState: "all",

      farmingType: "all",

    }

    


    onFiltersChange(clearedFilters)

    setZones([]); setWoredas([]); setKebeles([]); // Clear local options

  }



  const clearA2CFilters = () => onA2CFiltersChange(EMPTY_A2C_FILTERS)

  // Catalogues are national reference data and DevOps reports on infrastructure
  // rather than geography, so neither takes any filters. A2C takes its own set.
  const showRegistryFilters = dashboardType === "registries"
  const showFilterPanel = showRegistryFilters || isA2C

  const hiddenFilterNote =
    dashboardType === "catalogs"
      ? "Catalogues show national reference data, so the filters do not apply."
      : "DevOps monitors the platform estate, so the filters do not apply."

  return (
    <div className="h-screen flex flex-col bg-transparent">
      <div className="space-y-2 p-4 border-b border-white/15">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Dashboard</label>
        <Select value={dashboardType} onValueChange={(value) => onDashboardTypeChange(value as DashboardType)}>
          <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
            <SelectValue placeholder="Select dashboard" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="registries">Registries</SelectItem>
            <SelectItem value="catalogs">Catalogs</SelectItem>
            <SelectItem value="a2c">A2C - Access to Credit</SelectItem>
            <SelectItem value="devops">DevOps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!showFilterPanel && (
        <div className="p-4 text-xs leading-relaxed text-white/55">{hiddenFilterNote}</div>
      )}

      {showFilterPanel && (
      <div className="flex items-center justify-between p-4 bg-transparent border-b border-white/15">
        <h3 className="text-lg font-bold text-white">Filters</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={isA2C ? clearA2CFilters : clearAllFilters} 
          className="text-xs text-white/60 hover:text-white hover:bg-white/10"
        >
          Clear All
        </Button>
      </div>
      )}

      {isA2C && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* Credit Provider */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Credit Provider</label>
            <Select
              value={a2cFilters.provider}
              onValueChange={(value) => handleA2CFilterChange("provider", value)}
              disabled={isA2COptionsLoading}
            >
              <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
                <SelectValue placeholder={isA2COptionsLoading ? "Loading..." : "Select provider"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {a2cOptions.providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.status === "ONBOARDING" ? " (onboarding)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Region</label>
            <Select
              value={a2cFilters.region}
              onValueChange={(value) => handleA2CFilterChange("region", value)}
              disabled={isA2COptionsLoading}
            >
              <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
                <SelectValue placeholder={isA2COptionsLoading ? "Loading..." : "Select region"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {a2cRegions.map((region) => (
                  <SelectItem key={region.code} value={region.code}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Zone</label>
            <Select
              value={a2cFilters.zone}
              onValueChange={(value) => handleA2CFilterChange("zone", value)}
              disabled={isA2COptionsLoading}
            >
              <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
                <SelectValue placeholder={isA2COptionsLoading ? "Loading..." : "Select zone"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {a2cZones.map((zone) => (
                  <SelectItem key={zone.code} value={zone.code}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Woreda */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Woreda</label>
            <Select
              value={a2cFilters.woreda}
              onValueChange={(value) => handleA2CFilterChange("woreda", value)}
              disabled={isA2COptionsLoading}
            >
              <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
                <SelectValue placeholder={isA2COptionsLoading ? "Loading..." : "Select woreda"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Woredas</SelectItem>
                {a2cWoredas.map((woreda) => (
                  <SelectItem key={woreda.code} value={woreda.code}>
                    {woreda.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs leading-relaxed text-white/45">
            Only the woredas the credit programme currently reaches are listed. Enrolment stops at
            woreda, so there is no kebele level.
          </p>
        </div>
      )}

      {showRegistryFilters && (
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        
        {/* Region */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Region</label>
          <Select value={filters.region} onValueChange={(value) => handleFilterChange("region", value)} disabled={isLoading}>
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.code}>
                  {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Zone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Zone</label>
          <Select
            value={filters.zone}
            onValueChange={(value) => handleFilterChange("zone", value)}
            disabled={isZonesLoading || filters.region === 'all'}
          >
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70 disabled:opacity-50">
              <SelectValue placeholder={isZonesLoading ? "Loading..." : "Select zone"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones && zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.code}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Woreda */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Woreda</label>
          <Select
            value={filters.woreda}
            onValueChange={(value) => handleFilterChange("woreda", value)}
            disabled={isWoredasLoading || filters.zone === 'all'}
          >
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70 disabled:opacity-50">
              <SelectValue placeholder={isWoredasLoading ? "Loading..." : "Select woreda"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Woredas</SelectItem>
              {woredas && woredas.map((woreda) => (
                <SelectItem key={woreda.id} value={woreda.code}> 
                  {woreda.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kebele */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Kebele</label>
          <Select
            value={filters.kebele}
            onValueChange={(value) => handleFilterChange("kebele", value)}
            disabled={isKebelesLoading || filters.woreda === 'all'}
          >
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70 disabled:opacity-50">
              <SelectValue placeholder={isKebelesLoading ? "Loading..." : "Select kebele"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kebeles</SelectItem>
              {kebeles && kebeles.map((kebele) => (
                <SelectItem key={kebele.id} value={kebele.code}>
                  {kebele.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type of Farmer */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Type of Farmer</label>
          <Select value={filters.farmerType} onValueChange={(value) => handleFilterChange("farmerType", value)} disabled={isLoading}>
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
              <SelectValue placeholder={isLoading ? "Loading..." : "Select type of farmer"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Farmer Types</SelectItem>
              {farmerTypes.map((type) => (
                <SelectItem key={type.farmer_type} value={type.farmer_type}>
                  {type.farmer_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Record Status */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Record Status</label>
          <Select value={filters.recordState} onValueChange={(value) => handleFilterChange("recordState", value)} disabled={isLoading}>
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {recordStates.map((state) => (
                <SelectItem key={state.status} value={state.status}>
                  {state.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Farming Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Farming Type</label>
          <Select value={filters.farmingType} onValueChange={(value) => handleFilterChange("farmingType", value)}>
            <SelectTrigger className="w-full bg-white/10 text-white border-white/20 hover:border-white/40 hover:bg-white/15 transition-colors data-[placeholder]:text-white/50 [&_svg]:text-white/70">
              <SelectValue placeholder="Select farming type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crop">Crop Farming</SelectItem>
              <SelectItem value="livestock">Livestock Farming</SelectItem>
              <SelectItem value="mixed">Mixed Farming</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      )}
    </div>
  )
}
