"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CHART_COLORS } from "@/lib/theme-config"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend

} from "recharts"
import Image from "next/image"
import { MapWhenVisible } from "./lazy/map-when-visible"
import { HorizontalStackedBar } from "@/components/ui/horizontal-stacked-bar"
import { KPICard } from "@/components/kpi-card"
import { formatCompactNumber, formatFullNumber } from "@/lib/number-format"
import { useChartGroupData } from "@/hooks/use-data"
import { DashboardSectionSkeleton } from "@/components/ui/dashboard-skeleton"
import { AGE_BANDS, ageBandLabel } from "@/components/registry/registry-data"

interface DemographyChartsProps {
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

interface DemographyStats {
  total_regions: string
  total_woredas: string
  total_kebeles: string
}

interface FarmerPopulationData {
  region: string
  region_code?: string
  farmers: string
}

interface GenderByRegionData {
  region: string
  gender: string
  farmers: string
}

const COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.danger,
  CHART_COLORS.warning,
  CHART_COLORS.info,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
]

export function DemographyCharts({ filters, onMapFilterChange, geoJsonData, initialData }: DemographyChartsProps) {
  const chartNames = [
    'demographyStats',
    'farmersByRegion',
    'genderByRegion',
    'farmersByEducation',
    'farmersByAgeAndGender',
  ]
  const { data: dashboardData, loading, error: fetchError } = useChartGroupData(chartNames, filters, initialData)
  const errorMessage = fetchError || dashboardData?.errors?.[0]?.error || null;
  const charts = dashboardData?.data || {};
  const pruneUnknownZero = (items: any[], labelKey: string, valueKey: string) =>
    (items || []).filter(item => {
      const label = (item[labelKey] || '').toString().toLowerCase().trim()
      const value = parseInt(item[valueKey] || 0, 10)
      return !(label === 'unknown' && value === 0)
    })

  const demographyStats: DemographyStats | null = charts.demographyStats ? charts.demographyStats[0] : null
  // Use full farmersByRegion (no LIMIT) when available; fall back to the older farmerPopulationByRegion payload
  const farmerPopulationData: FarmerPopulationData[] = pruneUnknownZero(
    charts.farmersByRegion || charts.farmerPopulationByRegion || [],
    'region',
    'farmers'
  )
  const genderByRegionData: GenderByRegionData[] = pruneUnknownZero(charts.genderByRegion || [], 'gender', 'farmers')
  const educationData = pruneUnknownZero(charts.farmersByEducation || [], 'education', 'farmers')
  const ageGenderData = pruneUnknownZero(charts.farmersByAgeAndGender || [], 'gender', 'farmers')
  const errorBanner = errorMessage ? (
    <Card className="shadow-md border border-red-200">
      <CardContent className="p-4">
        <p className="text-sm text-red-600 font-medium">Failed to load demography data</p>
        <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
      </CardContent>
    </Card>
  ) : null

  // Process KPI data
  const kpiData = useMemo(() => {
    if (!demographyStats) {
      return {
        totalWoreda: 0,
        totalKebele: 0,
        totalRegions: 0,
        totalPopulation: 0,
      }
    }

    return {
      totalWoreda: parseInt(demographyStats.total_woredas) || 0,
      totalKebele: parseInt(demographyStats.total_kebeles) || 0,
      totalRegions: parseInt(demographyStats.total_regions) || 0,
      totalPopulation: farmerPopulationData.reduce((sum, item) => sum + parseInt(item.farmers), 0),
    }
  }, [demographyStats, farmerPopulationData])

  // Process population by region data for chart
  const populationByRegionChartData = useMemo(() => {
    return farmerPopulationData
      .map(item => ({
        region: item.region,
        farmers: parseInt(item.farmers)
      }))
      .sort((a, b) => b.farmers - a.farmers)
      .slice(0, 10)
  }, [farmerPopulationData])

  // Process gender by region data for chart
  const genderByRegionChartData = useMemo(() => {
    const regionMap = new Map<string, { region: string; male: number; female: number }>()

    genderByRegionData.forEach(item => {
      const region = item.region
      const farmers = parseInt(item.farmers)

      if (!regionMap.has(region)) {
        regionMap.set(region, { region, male: 0, female: 0 })
      }

      const regionData = regionMap.get(region)!
      if (item.gender === 'Male') {
        regionData.male = farmers
      } else if (item.gender === 'Female') {
        regionData.female = farmers
      }
    })

    return Array.from(regionMap.values())
      .sort((a, b) => (b.male + b.female) - (a.male + a.female))
      .slice(0, 8)
  }, [genderByRegionData])

  // Process education data for chart
  const educationChartData = useMemo(() => {
    return educationData
      .map(item => ({
        education: item.education,
        farmers: parseInt(item.farmers)
      }))
      .sort((a, b) => b.farmers - a.farmers)
  }, [educationData])

  // Process age and gender data for stacked chart
  const ageGenderChartData = useMemo(() => {
    const ageGroups: readonly string[] = AGE_BANDS
    const ageMap = new Map<string, { age_group: string; male: number; female: number; unknown: number }>()

    // Initialize all age groups
    ageGroups.forEach(group => {
      ageMap.set(group, { age_group: group, male: 0, female: 0, unknown: 0 })
    })

    // Populate with data
    ageGenderData.forEach(item => {
      const ageGroup = item.age_group
      const farmers = parseInt(item.farmers)
      const gender = item.gender.toLowerCase()

      if (ageMap.has(ageGroup)) {
        const groupData = ageMap.get(ageGroup)!
        if (gender === 'male') {
          groupData.male = farmers
        } else if (gender === 'female') {
          groupData.female = farmers
        } else {
          groupData.unknown = farmers
        }
      }
    })

    return ageGroups
      .map(group => ageMap.get(group)!)
      .filter(item => !(item.age_group.toLowerCase() === 'unknown' && (item.male + item.female + item.unknown === 0)))
      .map(item => ({ ...item, age_group: ageBandLabel(item.age_group) }))
  }, [ageGenderData])
  const showUnknownAge = useMemo(() => ageGenderChartData.some(item => item.unknown > 0), [ageGenderChartData])

  if (loading && !dashboardData) {
    return <DashboardSectionSkeleton />
  }

  return (
    <div className="space-y-6">
      {errorBanner}
      {/* Demography KPI Cards - Smaller */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">


        
      <KPICard
          title="Regions"
          value={formatCompactNumber(kpiData.totalRegions)}
          loading={loading}
          error={errorMessage}
          subtext="Regional Coverage"
          subtextColor="text-blue-600 dark:text-blue-400"
          iconSrc="/images/08_Configuration.png"
          iconAlt="Total Regions Reached"
          iconColorClass="text-info bg-info/10"
        />

        <KPICard
          title="Woreda"
          value={formatCompactNumber(kpiData.totalWoreda)}
          loading={loading}
          error={errorMessage}
          subtext="Total Woredas Reached"
          subtextColor="text-emerald-600 dark:text-emerald-400"
          iconSrc="/images/08_Configuration.png"
          iconAlt="Total Woredas Reached"
          iconColorClass="text-primary bg-primary/10"
        />

        <KPICard
          title="Kebele"
          value={formatCompactNumber(kpiData.totalKebele)}
          loading={loading}
          error={errorMessage}
          subtext="Total Kebeles Reached"
          subtextColor="text-amber-600 dark:text-amber-400"
          iconSrc="/images/11_Contacts.png"
          iconAlt="Total Kebeles Reached"
          iconColorClass="text-warning bg-warning/10"
        />


        <KPICard
          title="Total Farmers"
          value={formatCompactNumber(kpiData.totalPopulation)}
          loading={loading}
          error={errorMessage}
          subtext="Farmers Registered"
          subtextColor="text-purple-600 dark:text-purple-400"
          iconSrc="/images/02_Farmers.png"
          iconAlt="Population"
          iconColorClass="text-purple-600 bg-purple-500/10"
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
            farmerData={farmerPopulationData.map(item => ({
              region: item.region,
              region_code: item.region_code,
              farmers: parseInt(item.farmers),
            }))}
            onFilterChange={(mapFilters) => {
              if (onMapFilterChange) {
                onMapFilterChange(mapFilters)
              }
            }}
          />
        </div>

        {/* Right Side - Charts beside the map (two columns) */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Population by Region - Bar Chart */}
          <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6 w-full min-w-0">
              <h3 className="text-sm text-center  text-muted-foreground mb-3">Farmer Population by Region</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  farmers: {
                    label: "Farmers",
                    color: CHART_COLORS.primary,
                  },
                }}
                className="h-[260px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={populationByRegionChartData} margin={{ top: 20, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="region"
                      stroke={CHART_COLORS.primary}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 12, fontWeight: 'bold' }}
                    />

                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />

                    <Bar 
                      dataKey="farmers" 
                      fill={CHART_COLORS.primary} 
                      radius={[4, 4, 0, 0]}
                      label={{
                        position: "top",
                        fill: CHART_COLORS.primary,
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

        {/* Male and Female Farmers by Region - Stacked Bar Chart */}
        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Male and Female Farmers by Region</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <>
                  {/* Vertical Stacked Bar Chart */}
                <div className="mb-6">
                  <ChartContainer
                    config={{
                      male: { label: "Male Farmers", color: CHART_COLORS.primary },
                      female: { label: "Female Farmers", color: CHART_COLORS.secondary },
                    }}
                    className="h-[260px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genderByRegionChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        
                        <XAxis
                          dataKey="region"
                          stroke={CHART_COLORS.primary}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 12, fontWeight: 'bold' }}
                        />

                        <YAxis hide/>

                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />

                        <Bar dataKey="male" stackId="a" fill={CHART_COLORS.primary} name="Male Farmers" />
                         
                        <Bar
                          dataKey="female"
                          stackId="a"
                          fill={CHART_COLORS.secondary}
                          name="Female Farmers"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>

                {/* Horizontal Stacked Bar Chart - Gender Distribution Overview */}
                <HorizontalStackedBar
                  title="Gender Distribution Overview"
                  data={(() => {
                    const totalMale = genderByRegionChartData.reduce((sum, item) => sum + (item.male || 0), 0)
                    const totalFemale = genderByRegionChartData.reduce((sum, item) => sum + (item.female || 0), 0)
                    return [
                      { name: "Male Farmers", value: totalMale },
                      { name: "Female Farmers", value: totalFemale }
                    ]
                  })()}
                  colors={[CHART_COLORS.primary, CHART_COLORS.secondary]}
                  height={48}
                />
              </>
            )}
          </CardContent>
        </Card>

        </div>
      </div>

      {/* Charts beneath the map */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Farmers by Education Level</h3>
            <ChartContainer
              config={{
                farmers: { label: "Farmers", color: "#FCDB04" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={educationChartData} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="education" stroke={CHART_COLORS.primary} angle={-30} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="farmers" 
                    fill="#FAA71A" 
                    radius={[4, 4, 0, 0]}
                    label={{
                      position: "top",
                      fill: "#FAA71A",
                      fontSize: 12,
                      fontWeight: 600,
                      formatter: (value: any) => `${Number(value || 0).toLocaleString()}`,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Age Distribution and Gender</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  male: { label: "Male", color: CHART_COLORS.primary },
                  female: { label: "Female", color: CHART_COLORS.secondary },
                  ...(showUnknownAge ? { unknown: { label: "Unknown", color: CHART_COLORS.warning } } : {}),
                }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageGenderChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="age_group"
                      stroke={CHART_COLORS.primary}
                      tick={{ fontSize: 12, fontWeight: 'bold' }}
                    />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="male" stackId="a" fill={CHART_COLORS.primary} name="Male" />
                    <Bar
                      dataKey="female"
                      stackId="a"
                      fill={CHART_COLORS.secondary}
                      name="Female"
                      label={{
                        position: "top",
                        fill: CHART_COLORS.secondary,
                        fontSize: 12,
                        fontWeight: 500,
                        formatter: ((value: any, entry: any, index: any) => {
                          if (!entry || !entry.payload) return '';
                          const payload = entry.payload;
                          const total = (payload.male || 0) + (payload.female || 0) + (payload.unknown || 0);
                          return `${total.toLocaleString()}`;
                        }) as any,
                      }}
                    />
                    {showUnknownAge && (
                      <Bar dataKey="unknown" stackId="a" fill={CHART_COLORS.warning} name="Unknown" />
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
