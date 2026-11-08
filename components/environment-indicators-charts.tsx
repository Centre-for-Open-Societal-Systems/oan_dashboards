"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { mockData, filterData, aggregateData } from "@/lib/mock-data"
import { KPICards } from "@/components/kpi-cards"

interface EnvironmentIndicatorsChartsProps {
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

export function EnvironmentIndicatorsCharts({
  dateRange,
  selectedRegion,
  selectedIndicator,
  filters,
}: EnvironmentIndicatorsChartsProps) {
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

  // CO2 Emissions by Region
  const co2Data = useMemo(() => {
    const co2Filtered = filteredData.filter((d) => d.subcategory === "co2_emissions")
    return aggregateData(co2Filtered, ["region"])
      .map((d) => ({
        region: d.region,
        emissions: d.value,
      }))
      .slice(0, 8)
  }, [filteredData])

  // Forest Coverage Trends
  const forestData = useMemo(() => {
    const forestFiltered = filteredData.filter((d) => d.subcategory === "forest_coverage")
    return aggregateData(forestFiltered, ["year"])
      .map((d) => ({
        year: d.year.toString(),
        coverage: d.value,
      }))
      .sort((a: any, b: any) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])

  // Renewable Energy by Region
  const renewableData = useMemo(() => {
    const renewableFiltered = filteredData.filter((d) => d.subcategory === "renewable_energy")
    return aggregateData(renewableFiltered, ["region"])
      .map((d) => ({
        region: d.region,
        renewable: d.value,
      }))
      .slice(0, 8)
  }, [filteredData])

  // Environmental Trends
  const environmentTrendsData = useMemo(() => {
    const envFiltered = filteredData.filter((d) => d.category === "environment")
    return aggregateData(envFiltered, ["year", "subcategory"])
      .reduce((acc: any[], d: any) => {
        const existing = acc.find((item: any) => item.year === d.year.toString())
        if (existing) {
          existing[d.subcategory] = d.value
        } else {
          acc.push({
            year: d.year.toString(),
            [d.subcategory]: d.value,
          })
        }
        return acc
      }, [] as any[])
      .sort((a: any, b: any) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])

  return (
    <div className="space-y-6">
      <KPICards type="environment" filters={activeFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CO2 Emissions by Region */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CO2 Emissions by Region (Tons per Capita)</h3>
            <ChartContainer
              config={{
                emissions: { label: "CO2 Emissions", color: "#dc2626" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={co2Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#1e3a8a" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="emissions" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Forest Coverage Trends */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Forest Coverage Trends (%)</h3>
            <ChartContainer
              config={{
                coverage: { label: "Forest Coverage", color: "#059669" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forestData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="coverage"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ fill: "#059669", strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Renewable Energy by Region */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Renewable Energy by Region (%)</h3>
            <ChartContainer
              config={{
                renewable: { label: "Renewable Energy", color: "#f59e0b" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={renewableData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#1e3a8a" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="renewable" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Environmental Trends */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Environmental Indicators Trends</h3>
            <ChartContainer
              config={{
                co2_emissions: { label: "CO2 Emissions", color: "#dc2626" },
                forest_coverage: { label: "Forest Coverage", color: "#059669" },
                renewable_energy: { label: "Renewable Energy", color: "#f59e0b" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={environmentTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend verticalAlign="top" />

                  <Line type="monotone" dataKey="co2_emissions" stroke="#dc2626" strokeWidth={2} />
                  <Line type="monotone" dataKey="forest_coverage" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="renewable_energy" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
