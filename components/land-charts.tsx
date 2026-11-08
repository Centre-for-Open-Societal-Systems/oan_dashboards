"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
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
  GENDER_COLORS,
  CHART_COLORS,
} from "@/lib/theme-config"
import { MapWhenVisible } from "./lazy/map-when-visible"
import { HorizontalStackedBar } from "@/components/ui/horizontal-stacked-bar"
import { formatCompactNumber, formatFullNumber } from "@/lib/number-format"
import { KPICard } from "@/components/kpi-card"
import { useChartGroupData } from "@/hooks/use-data"
import { DashboardSectionSkeleton } from "@/components/ui/dashboard-skeleton"

interface LandChartsProps {
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

interface LandStats {
  total_land_area: string
  avg_land_area: string
  total_lands: string
  total_land_ownership: string
}

interface LandAreaByRegionData {
  region: string
  region_code?: string
  total_land_area?: string | number
  total_area?: string | number
  avg_land_area?: string | number
  avg_land?: string | number
  land_parcels?: string
  owned_parcels?: string
  rented_parcels?: string
}

interface AgeGroupData {
  region: string
  gender: string
  age_group: string
  farmers: string
}

// Colors are now managed centrally in theme-config.ts

export function LandCharts({ filters, onMapFilterChange, geoJsonData, initialData }: LandChartsProps) {
  const [showFullKpi, setShowFullKpi] = useState(false)
  const chartNames = [
    'landStats',
    'landAreaByRegion',
    'farmersByAgeGroupGenderRegion',
    'farmersByRegion',
  ]
  const { data: dashboardData, loading, error } = useChartGroupData(chartNames, filters, initialData)
  const errorMessage = error || dashboardData?.errors?.[0]?.error || null;

  const pruneUnknownZero = (items: any[], labelKey: string, valueKey: string) =>
    (items || []).filter(item => {
      const label = (item[labelKey] || '').toString().toLowerCase().trim()
      const value = parseInt(item[valueKey] || 0, 10)
      return !(label === 'unknown' && value === 0)
    })

  const charts = dashboardData?.data || {}
  const landStats: LandStats | null = charts.landStats ? charts.landStats[0] : null
  const landAreaByRegionData: LandAreaByRegionData[] = pruneUnknownZero(charts.landAreaByRegion || [], 'region', 'total_land_area')
  const ageGroupData: AgeGroupData[] = pruneUnknownZero(charts.farmersByAgeGroupGenderRegion || [], 'age_group', 'farmers')
  const farmersByRegionData = pruneUnknownZero(charts.farmersByRegion || [], 'region', 'farmers')
  const errorBanner = errorMessage ? (
    <Card className="shadow-md border border-red-200">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-red-600">Failed to load land data</p>
        <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
      </CardContent>
    </Card>
  ) : null

  // Process KPI data
  const kpiData = useMemo(() => {
    if (!landStats) {
      return {
        totalLandArea: 0,
        avgLandArea: 0,
        totalParcels: 0,
        ownedParcels: 0,
        rentedParcels: 0,
        sharedParcels: 0,
      }
    }

    return {
      totalLandArea: parseFloat(landStats.total_land_area) || 0,
      avgLandArea: parseFloat(landStats.avg_land_area) || 0,
      totalParcels: parseInt(landStats.total_lands) || 0,
      ownedParcels: parseInt(landStats.total_land_ownership) || 0,
      rentedParcels: 0, // Not available in current database
      sharedParcels: 0, // Not available in current database
      avgFarmSize: parseFloat(landStats.avg_land_area) || 0,
    }
  }, [landStats])

  // Land Area by Region Data for chart
  const landByRegionChartData = useMemo(() => {
    return landAreaByRegionData
      .map(item => {
        const rawTotal = item.total_land_area ?? item.total_area ?? 0
        const landArea = Math.round((parseFloat(String(rawTotal)) || 0) / 1000)
        return {
          region: item.region,
          landArea,
        }
      })
      .sort((a, b) => (b.landArea || 0) - (a.landArea || 0))
      .slice(0, 10)
  }, [landAreaByRegionData])

  // Land Ownership Distribution Data (simplified - just show owned vs rented)
  const landOwnershipData = useMemo(() => {
    const totalParcels = kpiData.totalParcels
    const ownedParcels = kpiData.ownedParcels
    const rentedParcels = kpiData.rentedParcels
    const sharedParcels = kpiData.sharedParcels

    // For simplicity, we'll show a basic distribution
    // In a real scenario, you'd want separate queries for different ownership types
    return [
      { name: "Owned", value: ownedParcels, color: CHART_COLORS.primary },
      { name: "Rented ", value: rentedParcels, color: CHART_COLORS.secondary },
      { name: "Shared", value: sharedParcels, color: CHART_COLORS.secondary },
    ]
  }, [kpiData])

  // Average Farm Size by Region Data
  const avgFarmSizeByRegionData = useMemo(() => {
    return landAreaByRegionData
      .map(item => {
        const rawAvg = item.avg_land_area ?? item.avg_land ?? 0
        const avgFarmSize = Math.round(parseFloat(String(rawAvg)) || 0)
        return {
          region: item.region,
          avgFarmSize,
        }
      })
      .sort((a, b) => (b.avgFarmSize || 0) - (a.avgFarmSize || 0))
      .slice(0, 8)
  }, [landAreaByRegionData])

  // Process age group data for chart
  const ageGroupChartData = useMemo(() => {
    const ageGroupMap = new Map<string, { age_group: string; male: number; female: number; unknown: number }>()

    ageGroupData.forEach(item => {
      const ageGroup = item.age_group
      const farmers = parseInt(item.farmers)

      if (!ageGroupMap.has(ageGroup)) {
        ageGroupMap.set(ageGroup, { age_group: ageGroup, male: 0, female: 0, unknown: 0 })
      }

      const ageData = ageGroupMap.get(ageGroup)!
      if (item.gender === 'Male') ageData.male += farmers
      else if (item.gender === 'Female') ageData.female += farmers
      else ageData.unknown += farmers
    })

    // Sort by age group order
    const ageOrder = ['Under 30', '30-50', '50-65', '65+']
    return ageOrder
      .map(age => ageGroupMap.get(age) || { age_group: age, male: 0, female: 0, unknown: 0 })
      .filter(item => !(item.age_group.toLowerCase() === 'unknown' && (item.male + item.female + item.unknown === 0)))
  }, [ageGroupData])
  const showUnknownAge = ageGroupChartData.some(item => item.unknown > 0)

  if (loading && !dashboardData) {
    return <DashboardSectionSkeleton />
  }

  return (
    <div className="space-y-6">
      {errorBanner}
      {/* Land KPI Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        onClick={() => setShowFullKpi(!showFullKpi)}
        title="Click to toggle full numbers"
      >
        <KPICard
          title="Total Land Area"
          value={loading ? '...' : formatCompactNumber(kpiData.totalLandArea / 1000)}
          loading={loading}
          error={errorMessage}
          subtext="Registered Parcels"
          subtextColor="text-amber-600 dark:text-amber-400"
          iconSrc="/images/07_Land.png"
          iconAlt="Total Land"
          iconColorClass="text-warning bg-warning/10"
        />

        <KPICard
          title="Average Land Area"
          value={loading ? '...' : formatCompactNumber(kpiData.avgLandArea)}
          loading={loading}
          error={errorMessage}
          subtext="Have Land Info"
          subtextColor="text-emerald-600 dark:text-emerald-400"
          iconSrc="/images/07_Land.png"
          iconAlt="Avg Land"
          iconColorClass="text-success bg-success/10"
        />

        <KPICard
          title="Total Lands"
          value={loading ? '...' : formatCompactNumber(kpiData.totalParcels)}
          loading={loading}
          error={errorMessage}
          subtext="Total Hectares"
          subtextColor="text-purple-600 dark:text-purple-400"
          iconSrc="/images/07_Land.png"
          iconAlt="Total Parcels"
          iconColorClass="text-purple-600 bg-purple-500/10"
        />

        <KPICard
          title="Avg Farm Size"
          value={loading ? '...' : formatCompactNumber(kpiData.avgFarmSize)}
          loading={loading}
          error={errorMessage}
          subtext="Hectares/Farmer"
          subtextColor="text-blue-600 dark:text-blue-400"
          iconSrc="/images/01_Profile.png"
          iconAlt="Avg Size"
          iconColorClass="text-info bg-info/10"
        />
      </div>

      {/* Main Layout: Map on Left, Charts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side - Ethiopia Map */}
        <div className="lg:col-span-2 space-y-4">
          <MapWhenVisible
            currentFilters={{
              region: filters.region !== 'all' ? filters.region : undefined,
              zone: filters.zone !== 'all' ? filters.zone : undefined,
              woreda: filters.woreda !== 'all' ? filters.woreda : undefined
            }}
            geoJsonData={geoJsonData}
            farmerData={farmersByRegionData.map(item => ({
              region: item.region,
              region_code: (item as any).region_code,
              farmers: parseInt((item as any).farmers || 0, 10),
            }))}
            onFilterChange={(mapFilters) => {
              if (onMapFilterChange) {
                onMapFilterChange(mapFilters)
              }
            }}
          />
        </div>

        {/* Right Side - Charts beside map (two columns) */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Land Area by Region - Bar Chart */}
          <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4 w-full min-w-0">
              <h3 className="text-sm text-center  text-muted-foreground mb-3">Land Area by Region</h3>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    landArea: {
                      label: "Land Area",
                      color: CHART_COLORS.primary,
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={landByRegionChartData}
                      margin={{ top: 20, right: 20, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="region"
                        stroke={CHART_COLORS.primary}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="landArea"
                        fill={CHART_COLORS.primary}
                        radius={[4, 4, 0, 0]}
                        label={{
                          position: "top",
                          fill: CHART_COLORS.primary,
                          fontSize: 12,
                          fontWeight: 500,
                          formatter: (value: any) => `${Number(value ?? 0).toLocaleString()}`,
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Land Ownership Distribution - Pie Chart */}
          <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4">
              <h3 className="text-sm text-center  text-muted-foreground mb-3">Land Ownership Distribution</h3>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <ChartContainer
                      config={{
                        owned: { label: "Farmland Owned", color: CHART_COLORS.primary },
                        rented: { label: "Farmland Rented", color: CHART_COLORS.secondary },
                      }}
                      className="h-[300px] w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={landOwnershipData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent, value }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                          >
                            {landOwnershipData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>

                  <HorizontalStackedBar
                    title="Land Ownership Overview"
                    data={landOwnershipData.map(item => ({
                      name: item.name,
                      value: item.value,
                      color: item.color
                    }))}
                    height={48}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts beneath the map */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 mt-4">
        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Average Farm Size by Region</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  avgFarmSize: { label: "Avg Farm Size", color: CHART_COLORS.secondary },
                }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgFarmSizeByRegionData} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="region" stroke={CHART_COLORS.secondary} angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke={CHART_COLORS.secondary} hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="avgFarmSize" 
                      fill={CHART_COLORS.secondary} 
                      radius={[4, 4, 0, 0]}
                      label={{
                        position: "top",
                        fill: CHART_COLORS.secondary,
                        fontSize: 12,
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

        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Farmers by Age Group and Gender</h3>
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
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageGroupChartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="age_group" stroke="#666" />
                    <YAxis stroke="#666" hide />
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
                        fontSize: 12,
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
      </div>
    </div>
  )
}
