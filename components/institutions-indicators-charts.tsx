"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"
import { mockData, filterData, aggregateData } from "@/lib/mock-data"
import { KPICards } from "@/components/kpi-cards"

interface InstitutionsIndicatorsChartsProps {
  dateRange: { from: Date | undefined; to: Date | undefined }
  selectedRegion: string
  selectedIndicator: string
  filters?: {
    dateRange: { from: Date | undefined; to: Date | undefined }
    region: string
    sector: string
    gender: string
    timePeriod: string
  }
}

const COLORS = ["#059669", "#f59e0b", "#dc2626", "#8b5cf6", "#06b6d4"]

export function InstitutionsIndicatorsCharts({
  dateRange,
  selectedRegion,
  selectedIndicator,
  filters,
}: InstitutionsIndicatorsChartsProps) {
  // Use global filters if provided, otherwise use component props
  const activeFilters = filters || {
    dateRange,
    region: selectedRegion,
    sector: "all",
    gender: "all",
    timePeriod: "all",
  }

  const filteredData = useMemo(() => {
    return filterData(mockData, activeFilters)
  }, [activeFilters])

  // Governance Effectiveness by Region
  const governanceData = useMemo(() => {
    const govFiltered = filteredData.filter((d) => d.subcategory === "governance_effectiveness")
    return aggregateData(govFiltered, ["region"])
      .map((d) => ({
        region: d.region,
        effectiveness: d.value,
      }))
      .slice(0, 8)
  }, [filteredData])

  // Corruption Index Trends
  const corruptionData = useMemo(() => {
    const corrFiltered = filteredData.filter((d) => d.subcategory === "corruption_index")
    return aggregateData(corrFiltered, ["year"])
      .map((d) => ({
        year: d.year.toString(),
        corruption: d.value,
      }))
      .sort((a, b) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])

  // Rule of Law by Region
  const ruleOfLawData = useMemo(() => {
    const rolFiltered = filteredData.filter((d) => d.subcategory === "rule_of_law")
    return aggregateData(rolFiltered, ["region"])
      .map((d) => ({
        region: d.region,
        rule_of_law: d.value,
      }))
      .slice(0, 8)
  }, [filteredData])

  // Institutional Quality Radar
  const institutionalRadarData = useMemo(() => {
    const instFiltered = filteredData.filter((d) => d.category === "institutions")
    const latest = Math.max(...instFiltered.map((d) => d.year))
    const latestData = instFiltered.filter((d) => d.year === latest)

    return aggregateData(latestData, ["subcategory"]).map((d) => ({
      indicator: d.subcategory.replace("_", " ").toUpperCase(),
      value: d.value,
    }))
  }, [filteredData])

  return (
    <div className="space-y-6">
      <KPICards type="institutions" filters={activeFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Governance Effectiveness by Region */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Governance Effectiveness by Region</h3>
            <ChartContainer
              config={{
                effectiveness: { label: "Governance Effectiveness", color: "#059669" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={governanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#1e3a8a" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="effectiveness" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Corruption Index Trends */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Corruption Index Trends (Lower is Better)</h3>
            <ChartContainer
              config={{
                corruption: { label: "Corruption Index", color: "#dc2626" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={corruptionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="corruption"
                    stroke="#dc2626"
                    strokeWidth={3}
                    dot={{ fill: "#dc2626", strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Rule of Law by Region */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule of Law by Region (%)</h3>
            <ChartContainer
              config={{
                rule_of_law: { label: "Rule of Law", color: "#8b5cf6" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ruleOfLawData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#1e3a8a" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="rule_of_law" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Institutional Quality Radar */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Institutional Quality Overview</h3>
            <ChartContainer
              config={{
                value: { label: "Score", color: "#f59e0b" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={institutionalRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="indicator" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Institutional Quality"
                    dataKey="value"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
