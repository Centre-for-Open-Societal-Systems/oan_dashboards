"use client"

import { useMemo } from "react"
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
  HOUSEHOLD_STATUS_COLORS,
  CHART_COLORS,
} from "@/lib/theme-config"
import { MapWhenVisible } from "./lazy/map-when-visible"
import { HorizontalStackedBar } from "@/components/ui/horizontal-stacked-bar"
import { formatCompactNumber } from "@/lib/number-format"
import { KPICard } from "@/components/kpi-card"
import { useChartGroupData } from "@/hooks/use-data"
import { DashboardSectionSkeleton } from "@/components/ui/dashboard-skeleton"

interface SocioEconomicChartsProps {
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

interface SocioEconomicKPIs {
  total_female_farmers: string
  total_male_farmers: string
  female_farmers_in_household: string
  male_farmers_in_household: string
  total_household_heads: string
  male_household_heads: string
  female_household_heads: string
}

interface HouseholdStatusData {
  region: string
  gender: string
  household_status: string
  farmers: string
}

interface AgeGroupData {
  region: string
  gender: string
  age_group: string
  farmers: string
}

export function SocioEconomicCharts({ filters, onMapFilterChange, geoJsonData, initialData }: SocioEconomicChartsProps) {
  const chartNames = [
    'socioEconomicKpis',
    'householdStatusByGenderRegion',
    'farmersByAgeGroupGenderRegion',
    'farmersByRegion',
    'householdIncomeSources',
    'farmersByPsnpStatus',
  ]
  const { data: dashboardData, loading, error } = useChartGroupData(chartNames, filters, initialData)
  const errorMessage = error || dashboardData?.errors?.[0]?.error || null;
  const charts = dashboardData?.data || {};
  const pruneUnknownZero = (items: any[], labelKey: string, valueKey: string) =>
    (items || []).filter(item => {
      const label = (item[labelKey] || '').toString().toLowerCase().trim()
      const value = parseInt(item[valueKey] || 0, 10)
      return !(label === 'unknown' && value === 0)
    })

  const socioEconomicKPIs: SocioEconomicKPIs | null = charts.socioEconomicKpis ? charts.socioEconomicKpis[0] : null
  const householdStatusData: HouseholdStatusData[] = pruneUnknownZero(charts.householdStatusByGenderRegion || [], 'household_status', 'farmers')
  const ageGroupData: AgeGroupData[] = pruneUnknownZero(charts.farmersByAgeGroupGenderRegion || [], 'age_group', 'farmers')
  const farmersByRegionData: any[] = pruneUnknownZero(charts.farmersByRegion || [], 'region', 'farmers')
  const incomeSources: any[] = pruneUnknownZero(charts.householdIncomeSources || [], 'income_source', 'farmers')
  const psnpData: any[] = pruneUnknownZero(charts.farmersByPsnpStatus || [], 'psnp_status', 'farmers')
  const psnpChartData = useMemo(() => {
    return psnpData.map(item => ({
      ...item,
      farmers: parseInt(item.farmers || 0, 10),
      key: (item.psnp_status || '').toString().toLowerCase().replace(/\s+/g, '_') || 'unknown',
    }))
  }, [psnpData])
  const errorBanner = errorMessage ? (
    <Card className="shadow-md border border-red-200">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-red-600">Failed to load socio-economic data</p>
        <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
      </CardContent>
    </Card>
  ) : null

  const kpiData = useMemo(() => {
    if (!socioEconomicKPIs) {
      return {
        totalFemaleFarmers: 0,
        totalMaleFarmers: 0,
        femaleFarmersInHousehold: 0,
        maleFarmersInHousehold: 0,
        totalHouseholdHeads: 0,
        femaleHouseholdHeads: 0,
        maleHouseholdHeads: 0,
      }
    }

    return {
      totalFemaleFarmers: parseInt(socioEconomicKPIs.total_female_farmers) || 0,
      totalMaleFarmers: parseInt(socioEconomicKPIs.total_male_farmers) || 0,
      femaleFarmersInHousehold: parseInt(socioEconomicKPIs.female_farmers_in_household) || 0,
      maleFarmersInHousehold: parseInt(socioEconomicKPIs.male_farmers_in_household) || 0,
      totalHouseholdHeads: parseInt(socioEconomicKPIs.total_household_heads) || 0,
      femaleHouseholdHeads: parseInt(socioEconomicKPIs.female_household_heads) || 0,
      maleHouseholdHeads: parseInt(socioEconomicKPIs.male_household_heads) || 0,
    }
  }, [socioEconomicKPIs])

  const householdHeadsData = useMemo(() => {
    return [
      { name: "Female Heads", value: kpiData.femaleHouseholdHeads, color: GENDER_COLORS.female },
      { name: "Male Heads", value: kpiData.maleHouseholdHeads, color: GENDER_COLORS.male },
    ]
  }, [kpiData.femaleHouseholdHeads, kpiData.maleHouseholdHeads])

  const incomeSourceChartData = useMemo(() => {
    return incomeSources.map(item => ({
      name: item.income_source,
      code: item.income_code,
      farmers: parseInt(item.farmers || 0),
    }))
  }, [incomeSources])

  const householdStatusChartData = useMemo(() => {
    const regionMap = new Map<string, { region: string; male_head: number; female_head: number; male_member: number; female_member: number }>()

    householdStatusData.forEach(item => {
      const region = item.region
      const farmers = parseInt(item.farmers)

      if (!regionMap.has(region)) {
        regionMap.set(region, { region, male_head: 0, female_head: 0, male_member: 0, female_member: 0 })
      }

      const regionData = regionMap.get(region)!
      const key = `${item.gender.toLowerCase()}_${item.household_status.toLowerCase()}`

      if (key === 'male_head') regionData.male_head = farmers
      else if (key === 'female_head') regionData.female_head = farmers
      else if (key === 'male_member') regionData.male_member = farmers
      else if (key === 'female_member') regionData.female_member = farmers
    })

    return Array.from(regionMap.values())
      .filter(item => !(item.region.toLowerCase() === 'unknown' && (item.male_head + item.female_head + item.male_member + item.female_member === 0)))
      .slice(0, 8)
  }, [householdStatusData])

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Female Farmers */}
        <KPICard
          title="Female Farmers"
          value={formatCompactNumber(kpiData.totalFemaleFarmers)}
          loading={loading}
          error={errorMessage}
          subtext="Female Farmers Registered"
          subtextColor="text-rose-600 dark:text-rose-400"
          iconSrc="/images/02_Farmers.png"
          iconColorClass="text-danger bg-danger/10"
        />

        {/* Male Farmers */}
        <KPICard
          title="Male Farmers"
          value={formatCompactNumber(kpiData.totalMaleFarmers)}
          loading={loading}
          error={errorMessage}
          subtext="Male Farmers Registered"
          subtextColor="text-blue-600 dark:text-blue-400"
          iconSrc="/images/02_Farmers.png"
          iconColorClass="text-info bg-info/10"
        />

        {/* Farmers in Household */}
        <KPICard
          title="Farmers in Household"
          value={formatCompactNumber(kpiData.femaleFarmersInHousehold + kpiData.maleFarmersInHousehold)}
          loading={loading}
          error={errorMessage}
          subtext="Registerd In Households"
          subtextColor="text-purple-600 dark:text-purple-400"
          iconSrc="/images/03_Households.png"
          iconColorClass="text-purple-600 bg-purple-500/10"
        />

        {/* Household Heads */}
        <KPICard
          title="Household Heads"
          value={formatCompactNumber(kpiData.totalHouseholdHeads)}
          loading={loading}
          error={errorMessage}
          subtext={(loading ? '...' : `${((householdHeadsData[1].value / (householdHeadsData[0].value + householdHeadsData[1].value)) * 100 || 0).toFixed(1)}% of Heads`)}
          subtextColor="text-blue-600 dark:text-blue-400"
          iconSrc="/images/02_Farmers.png"
          iconAlt="Male Heads"
          iconColorClass="text-info bg-info/10"
        />

        {/* PSNP Users KPI */}
        <KPICard
          title="PSNP Users"
          value={formatCompactNumber(parseInt(psnpData.find(d => d.psnp_status === 'PSNP User')?.farmers || 0))}
          loading={loading}
          error={errorMessage}
          subtext={(loading ? '...' : `${((parseInt(psnpData.find(d => d.psnp_status === 'PSNP User')?.farmers || 0) / (psnpData.reduce((acc, curr) => acc + parseInt(curr.farmers || 0), 0) || 1)) * 100).toFixed(1)}% of Total`)}
          subtextColor="text-amber-600 dark:text-amber-400"
          iconSrc="/images/02_Farmers.png"
          iconColorClass="text-amber-600 bg-amber-500/10"
        />
      </div>

      {/* Main Layout: Map on Left, Charts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <MapWhenVisible
            currentFilters={{
              region: filters.region !== 'all' ? filters.region : undefined,
              zone: filters.zone !== 'all' ? filters.zone : undefined,
              woreda: filters.woreda !== 'all' ? filters.woreda : undefined
            }}
            geoJsonData={geoJsonData}
            onFilterChange={(mapFilters) => {
              if (onMapFilterChange) {
                onMapFilterChange(mapFilters)
              }
            }}
            farmerData={farmersByRegionData.map(item => ({
              region: item.region,
              region_code: item.region_code,
              farmers: parseInt(item.farmers),
            }))}
          />
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4 w-full min-w-0">
              <h3 className="text-sm text-center  text-muted-foreground mb-3">Household Income Sources</h3>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    farmers: { label: "Farmers", color: GENDER_COLORS.male },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeSourceChartData} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#0B9147" angle={-35} textAnchor="end" height={80} />
                      <YAxis stroke="#0B9147" hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="farmers" 
                        fill={GENDER_COLORS.male} 
                        radius={[4, 4, 0, 0]}
                        label={{
                          position: "top",
                          fill: GENDER_COLORS.male,
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
            <CardContent className="p-4 w-full min-w-0">
              <h3 className="text-sm text-center  text-muted-foreground mb-3">Female vs Male Household Heads</h3>

              <div className="mb-3">
                <ChartContainer
                  config={{
                    female: { label: "Female Heads", color: GENDER_COLORS.female },
                    male: { label: "Male Heads", color: GENDER_COLORS.male },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={householdHeadsData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {householdHeadsData.map((entry, index) => (
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
                title="Household Head Distribution"
                data={householdHeadsData.map(item => ({
                  name: item.name,
                  value: item.value,
                  color: item.color
                }))}
                height={48}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">Household Status by Gender and Region</h3>
            <ChartContainer
              config={{
                male_head: { label: "Male Heads", color: HOUSEHOLD_STATUS_COLORS.male_head },
                female_head: { label: "Female Heads", color: HOUSEHOLD_STATUS_COLORS.female_head },
                male_member: { label: "Male Members", color: HOUSEHOLD_STATUS_COLORS.male_member },
                female_member: { label: "Female Members", color: HOUSEHOLD_STATUS_COLORS.female_member },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={householdStatusChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#666" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#666" hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="male_head" stackId="a" fill={HOUSEHOLD_STATUS_COLORS.male_head} name="Male Heads" />
                  <Bar dataKey="female_head" stackId="a" fill={HOUSEHOLD_STATUS_COLORS.female_head} name="Female Heads" />
                  <Bar dataKey="male_member" stackId="b" fill={HOUSEHOLD_STATUS_COLORS.male_member} name="Male Members" />
                  <Bar dataKey="female_member" stackId="b" fill={HOUSEHOLD_STATUS_COLORS.female_member} name="Female Members" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
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
                  <BarChart data={ageGroupChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
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


        <Card className="border border-white/20 dark:border-white/5 bg-white/60 dark:bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4">
            <h3 className="text-sm text-center  text-muted-foreground mb-3">PSNP Status</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
                <ChartContainer
                  config={{
                    psnp_user: { label: "PSNP User", color: CHART_COLORS.primary },
                    non_psnp: { label: "Non-PSNP", color: CHART_COLORS.secondary },
                    unknown: { label: "Unknown", color: CHART_COLORS.warning },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={psnpChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="farmers"
                        nameKey="psnp_status"
                        paddingAngle={2}
                      >
                         {psnpChartData.map((entry, index) => {
                          const key = entry.key
                          const color =
                            key === 'psnp_user' ? CHART_COLORS.primary :
                            key === 'non-psnp' || key === 'non_psnp' ? CHART_COLORS.secondary :
                            CHART_COLORS.warning
                          return <Cell key={`cell-${index}`} fill={color} />
                        })}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
            )}
          </CardContent>
        </Card>





      </div>

    </div>
  )
}
