"use client"
//components/farmer-dashboard-charts.tsx
import { useMemo, useState } from "react"
import { formatNumber } from "@/lib/format-utils"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { HorizontalStackedBar } from "@/components/ui/horizontal-stacked-bar"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import Image from "next/image"
import {
  getKPICardStyle,
  getKPICardClasses,
  EXTENDED_CHART_COLORS,
  CHART_CONFIG_PRESETS,
  SOLID_KPI_BACKGROUNDS,
  CHART_COLORS,
  GENDER_COLORS,
} from "@/lib/theme-config"
import { KPICard } from "@/components/kpi-card"
import { formatCompactNumber, formatFullNumber } from "@/lib/number-format"
import { useChartGroupData } from "@/hooks/use-data"
import { DashboardSectionSkeleton } from "@/components/ui/dashboard-skeleton"
import { AGE_BANDS, ageBandLabel } from "@/components/registry/registry-data"

interface FarmerDashboardChartsProps {
  filters: {
    region: string
    zone: string
    woreda: string
    kebele: string
    farmerType: string
    recordState: string
    farmingType: string
  }
  onMapFilterChange?: (filters: { region?: string; zone?: string; woreda?: string }) => void
  geoJsonData?: any
  initialData?: any // SSR seed; client refetch keeps filters fresh
}

import { MapWhenVisible } from "./lazy/map-when-visible"

// Colors are now managed centrally in theme-config.ts

export function FarmerDashboardCharts({ filters, onMapFilterChange, geoJsonData, initialData }: FarmerDashboardChartsProps) {
  const [showFullKpi, setShowFullKpi] = useState(false)
  const chartNames = [
    'farmersByRegion',
    'farmersByType',
    'farmersByImportStatus',
    'farmerKpis',
    'farmersByAgeAndGender',
  ]
  const { data: dashboardData, loading, error } = useChartGroupData(chartNames, filters, initialData)

  const pruneUnknownZero = (items: any[], labelKey: string, valueKey: string) =>
    (items || []).filter(item => {
      const label = (item[labelKey] || '').toString().toLowerCase().trim()
      const value = parseInt(item[valueKey] || 0, 10)
      return !(label === 'unknown' && value === 0)
    })

  const errorMessage = error || dashboardData?.errors?.[0]?.error || null;
  const charts = dashboardData?.data || {};
  const regionData = pruneUnknownZero(
    charts.farmersByRegion || charts.farmerPopulationByRegion || [],
    'region',
    'farmers'
  );
  const typeData = pruneUnknownZero(charts.farmersByType || [], 'farming_type', 'farmers');
  const importData = pruneUnknownZero(charts.farmersByImportStatus || [], 'import_status', 'farmers');
  const kpiData = charts.farmerKpis ? charts.farmerKpis[0] : null;
  const ageGenderData = charts.farmersByAgeAndGender || [];

  // Transform data for charts
  const farmersByRegionData = useMemo(() => {
    return regionData.map((d) => ({
      region: d.region,
       region_code: (d as any).region_code,
      farmers: parseInt(d.farmers),
    }))
  }, [regionData])

  const farmersByTypeData = useMemo(() => {
    return typeData.map((d) => ({
      type: d.farming_type?.replace('_', ' ') || 'Unknown',
      farmers: parseInt(d.farmers),
    }))
  }, [typeData])
 
  // Imported farmers data from API
  const importedFarmersData = useMemo(() => {
    return importData.map((d) => ({
      status: d.import_status,
      farmers: parseInt(d.farmers),
    }))
  }, [importData])

  const ageGenderChartData = useMemo(() => {
    const ageMap = new Map<string, { age_group: string; male: number; female: number; unknown: number }>()
    AGE_BANDS.forEach(group => ageMap.set(group, { age_group: group, male: 0, female: 0, unknown: 0 }))

    ageGenderData.forEach((item: any) => {
      const ageGroup = item.age_group || 'UNKNOWN'
      const farmers = parseInt(item.farmers || 0, 10)
      const gender = (item.gender || '').toLowerCase()
      const target = ageMap.get(ageGroup) || { age_group: ageGroup, male: 0, female: 0, unknown: 0 }
      if (gender === 'male') target.male = farmers
      else if (gender === 'female') target.female = farmers
      else target.unknown = farmers
      ageMap.set(ageGroup, target)
    })

    const cleaned = Array.from(ageMap.values()).filter(item => !(item.age_group.toLowerCase() === 'unknown' && item.male + item.female + item.unknown === 0))
    return cleaned.map(item => ({ ...item, age_group: ageBandLabel(item.age_group) }))
  }, [ageGenderData])
  const showUnknownAge = useMemo(() => ageGenderChartData.some(item => item.unknown > 0), [ageGenderChartData])

  // Transform KPI data from database
  const kpiStats = useMemo(() => {
    if (!kpiData) {
      return {
        totalFarmers: 0,
        totalLandSize: 0,
        femaleFarmers: 0,
        maleFarmers: 0,
        householdHeads: 0,
        farmlandsOwned: 0,
        avgFarmSize: 0,
      }
    }

    const totalFarmers = parseInt(kpiData.total_farmers || 0)
    const femaleFarmers = parseInt(kpiData.female_farmers || 0)
    const maleFarmers = parseInt(kpiData.male_farmers || 0)
    const totalLandSize = parseFloat(kpiData.total_land_size || 0)
    const avgFarmSize = parseFloat(kpiData.avg_farm_size || 0)

    return {
      totalFarmers,
      totalLandSize,
      femaleFarmers,
      maleFarmers,
      
      householdHeads: parseInt(kpiData.household_heads || 0), 
      farmlandsOwned: parseInt(kpiData.farmers_with_owned_land || 0),
      
      avgFarmSize,
    }
  }, [kpiData])

  // Remove the separate loading state - we'll handle it inline like other tabs
  const displayNumber = (value: number | string | null | undefined) =>
    showFullKpi ? formatFullNumber(value) : formatCompactNumber(value)

  if (loading && !dashboardData) {
    return <DashboardSectionSkeleton />
  }

  // Show error state
  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-semibold">Error loading dashboard data</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Farmer KPI Cards - Smaller */}

      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
        onClick={() => setShowFullKpi(!showFullKpi)}
        title="Click to toggle full numbers"
      >
        <KPICard
          title="Total Farmers"
          value={loading ? "..." : errorMessage ? "Error" : displayNumber(kpiStats.totalFarmers)}
          loading={loading}
          iconSrc="/images/02_Farmers.png"
          iconAlt="Total Farmers"
          iconColorClass="text-primary bg-primary/10"
          subtext="Registered"
          subtextColor="text-emerald-600 dark:text-emerald-400"
        />

        <KPICard
          title="Land Size"
          value={loading ? "..." : errorMessage ? "Error" : displayNumber(kpiStats.totalLandSize)}
          loading={loading}
          iconSrc="/images/07_Land.png"
          iconAlt="Land"
          iconColorClass="text-warning bg-warning/10"
          subtext="Hectares"
          subtextColor="text-amber-600 dark:text-amber-400"
        />

        <KPICard
          title="Female Farmers"
          value={loading ? "..." : errorMessage ? "Error" : displayNumber(kpiStats.femaleFarmers)}
          loading={loading}
          iconSrc="/images/02_Farmers.png"
          iconAlt="Female Farmers"
          iconColorClass="text-danger bg-danger/10"
          subtext={(loading ? "..." : `${((kpiStats.femaleFarmers / kpiStats.totalFarmers) * 100 || 0).toFixed(1)}%`)}
          subtextColor="text-rose-600 dark:text-rose-400"
        />

        <KPICard
          title="Male Farmers"
          value={loading ? "..." : errorMessage ? "Error" : displayNumber(kpiStats.maleFarmers)}
          loading={loading}
          iconSrc="/images/02_Farmers.png"
          iconAlt="Male Farmers"
          iconColorClass="text-info bg-info/10"
          subtext={(loading ? "..." : `${((kpiStats.maleFarmers / kpiStats.totalFarmers) * 100 || 0).toFixed(1)}%`)}
          subtextColor="text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Additional KPI Cards Row - Smaller */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        onClick={() => setShowFullKpi(!showFullKpi)}
        title="Click to toggle full numbers"
      >
        <KPICard
          title="Household Heads"
          value={loading ? "..." : displayNumber(kpiStats.householdHeads)}
          loading={loading}
          iconSrc="/images/03_Households.png"
          iconAlt="Households"
          iconColorClass="text-purple-600 bg-purple-500/10"
          subtext="Heads"
          subtextColor="text-purple-600 dark:text-purple-400"
        />

        <KPICard
          title="Other Database Imported Farmers"
          value={loading ? "..." : formatNumber(importedFarmersData.find(d => d.status === 'Imported')?.farmers || 0)}
          loading={loading}
          iconSrc="/images/01_Profile.png"
          iconAlt="Imported"
          iconColorClass="text-danger bg-danger/10"
          subtext={(loading ? "..." : `${((importedFarmersData.find(d => d.status === 'Imported')?.farmers || 0) / kpiStats.totalFarmers * 100 || 0).toFixed(1)}%`)}
          subtextColor="text-blue-600 dark:text-blue-400"
          className="bg-gradient-to-br from-background to-card/80 dark:from-card/90 dark:to-card/70 border-border/30 hover:border-primary/20 hover:translate-y-[-2px]"
        />

        <Card className="relative overflow-hidden bg-gradient-to-br from-background to-card/80 dark:from-card/90 dark:to-card/70 rounded-xl border border-border/30 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:translate-y-[-2px]">
          <CardContent className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Land Owner Farmers</p>
                <div className="text-lg font-semibold text-foreground">
                  {loading ? "..." : displayNumber(kpiStats.farmlandsOwned)}
                </div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">Land Ownership: Owner</p>
              </div>
              <Image src="/images/07_Land.png" alt="Land Ownership" width={24} height={24} className="opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-background to-card/80 dark:from-card/90 dark:to-card/70 rounded-xl border border-border/30 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:translate-y-[-2px]">
          <CardContent className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Farm Size</p>
                <div className="text-xl font-semibold text-foreground">
                  {loading
                    ? "..."
                    : showFullKpi
                      ? formatFullNumber(kpiStats.avgFarmSize)
                      : formatCompactNumber(kpiStats.avgFarmSize)}
                </div>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">Hectares per Farmer</p>
              </div>
              <Image src="/images/07_Land.png" alt="Farm Size" width={32} height={32} className="opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout: Map on Left, Charts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Ethiopia Map */}
        <div className="lg:col-span-2">
          <MapWhenVisible
            currentFilters={{
              region: filters.region !== 'all' ? filters.region : undefined,
              zone: filters.zone !== 'all' ? filters.zone : undefined,
              woreda: filters.woreda !== 'all' ? filters.woreda : undefined
            }}
            onFilterChange={(mapFilters) => {
              if (onMapFilterChange) {
                onMapFilterChange(mapFilters)
              }
            }}
            farmerData={farmersByRegionData}
            geoJsonData={geoJsonData}
          />
        </div>

        {/* Right Column - two charts beside the map */}
        <div className="lg:col-span-3 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-lg overflow-hidden border border-border/50 shadow-none transition-all duration-300">
            <CardContent className="p-4">
              {/* <h3 className="text-sm font-semibold text-center tracking-wider text-muted-foreground mb-4">Farmers in Regions</h3> */}
              <h4 className="text-sm text-center  text-muted-foreground mb-3">Farmers in Regions</h4>

              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : errorMessage ? (
                <div className="h-[250px] flex items-center justify-center bg-red-50 border border-red-200 rounded">
                  <div className="text-center">
                    <div className="text-red-600 font-semibold mb-2">Query Failed</div>
                    <div className="text-sm text-red-500">{errorMessage}</div>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    farmers: { label: "Farmers", color: CHART_COLORS.primary },
                  }}
                  className="h-[320px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={farmersByRegionData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                      <XAxis
                        dataKey="region"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tickMargin={10}
                      />
                      <YAxis hide />
                      <ChartTooltip 
                        content={<ChartTooltipContent 
                          className="bg-background/95 backdrop-blur-sm border-primary/20 shadow-xl" 
                        />} 
                        cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                      />
                      <Bar
                        dataKey="farmers"
                        fill={CHART_COLORS.primary}
                        radius={[6, 6, 0, 0]}
                        fillOpacity={0.9}
                        label={{
                          position: "top",
                          fill: CHART_COLORS.primary,
                          fontSize: 10,
                          fontWeight: 600,
                          formatter: (value: any) => `${Number(value || 0).toLocaleString()}`,
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-lg overflow-hidden border border-border/50 shadow-none transition-all duration-300">
            <CardContent className="p-4">
              <h4 className="text-sm text-center  text-muted-foreground mb-3">Famers and Farming Type</h4>
              <div className="mb-3">
                <ChartContainer
                  config={{
                    livestock: { label: "Livestock Farming", color: CHART_COLORS.secondary },
                    crop: { label: "Crop Farming", color: CHART_COLORS.primary },
                    mixed: { label: "Mixed Farming", color: CHART_COLORS.warning },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={farmersByTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent = 0, value = 0 }) => `${value.toLocaleString()}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="farmers"
                        nameKey="type"
                        fontSize={12}
                        fontWeight="bold"
                      >
                        {farmersByTypeData.map((entry, index) => {
                          const colors = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.warning];
                          return (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          );
                        })}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              <HorizontalStackedBar
                title="Distribution Overview"
                data={farmersByTypeData.map((item, index) => {
                  const colors = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.warning]
                  return {
                    name: item.type,
                    value: item.farmers,
                    color: colors[index % colors.length],
                  }
                })}
                height={48}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts beneath the map */}
      <div className="grid grid-cols-1 md:grid-cols-2  gap-6">
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-lg shadow-none border border-border/50 overflow-hidden transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center text-muted-foreground mb-3">Age & Gender Distribution</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  male: { label: "Male", color: GENDER_COLORS.male },
                  female: { label: "Female", color: GENDER_COLORS.female },
                  ...(showUnknownAge ? { unknown: { label: "Unknown", color: GENDER_COLORS.unknown } } : {}),
                }}
                className="h-[320px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageGenderChartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="age_group" stroke={CHART_COLORS.primary} />
                    <YAxis stroke={CHART_COLORS.primary} hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="male" stackId="a" fill={GENDER_COLORS.male} name="Male" />
                    <Bar 
                      dataKey="female" 
                      stackId="a" 
                      fill={GENDER_COLORS.female} 
                      name="Female"
                      label={{
                        position: "top",
                        fill: GENDER_COLORS.female,
                        fontSize: 10,
                        fontWeight: 600,
                        formatter: ((value: any, entry: any, index: any) => {
                           if (!entry || !entry.payload) return '';
                           const payload = entry.payload;
                           const total = (payload.male || 0) + (payload.female || 0) + (payload.unknown || 0);
                           return `${total.toLocaleString()}`;
                        }) as any,
                      }} 
                    />
                    {showUnknownAge && (
                      <Bar dataKey="unknown" stackId="a" fill={GENDER_COLORS.unknown} name="Unknown" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

      

        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-lg  shadow-none border border-border/50 overflow-hidden transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Database Imported Farmers</h3>
            <ChartContainer
              config={{
                imported: { label: "Database Imported Farmers", color: CHART_COLORS.primary },
                not_imported: { label: "ODK Collected Farmers", color: CHART_COLORS.secondary },
              }}
              className="h-[220px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={importedFarmersData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent, value }) => `${value.toLocaleString()}`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="farmers"
                    nameKey="status"
                    fontSize={14}
                    fontWeight="bold"
                  >
                    {importedFarmersData.map((entry, index) => {
                      const colors = [CHART_COLORS.primary, CHART_COLORS.secondary];
                      return (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      );
                    })}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>



    </div>
  )
}
