// @ts-nocheck
"use client"
//components/social-indicators-charts.tsx

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
  Legend
} from "recharts"
import { mockData, filterData, aggregateData } from "@/lib/mock-data"
import { KPICards } from "@/components/kpi-cards"

interface SocialIndicatorsChartsProps {
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

export function SocialIndicatorsCharts({
  dateRange,
  selectedRegion,
  selectedIndicator,
  filters,
}: SocialIndicatorsChartsProps) {
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

  // Education Data by Gender
  const educationData = useMemo(() => {
    const eduFiltered = filteredData.filter((d) => d.subcategory === "education" && d.category === "social")
    return aggregateData(eduFiltered, ["year", "gender"])
      .reduce((acc, d) => {
        const existing = acc.find((item) => item.year === d.year.toString())
        if (existing) {
          existing[d.gender || "all"] = d.value
        } else {
          acc.push({
            year: d.year.toString(),
            [d.gender || "all"]: d.value,
          })
        }
        return acc
      }, [] as any[])
      .sort((a, b) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])

  // Health Data by Region
  const healthData = useMemo(() => {
    const healthFiltered = filteredData.filter((d) => d.subcategory === "health" && d.category === "social")
    return aggregateData(healthFiltered, ["region"])
      .map((d) => ({
        region: d.region,
        value: d.value,
      }))
      .slice(0, 8)
  }, [filteredData])

  // Employment Trends
  const employmentData = useMemo(() => {
    const empFiltered = filteredData.filter((d) => d.subcategory === "employment" && d.category === "social")
    return aggregateData(empFiltered, ["year"])
      .map((d) => ({
        year: d.year.toString(),
        employment: d.value,
      }))
      .sort((a, b) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])

  // Literacy by Gender
  const literacyData = useMemo(() => {
    const litFiltered = filteredData.filter((d) => d.subcategory === "literacy" && d.category === "social")
    return aggregateData(litFiltered, ["year", "gender"])
      .reduce((acc, d) => {
        const existing = acc.find((item) => item.year === d.year.toString())
        if (existing) {
          existing[d.gender || "all"] = d.value
        } else {
          acc.push({
            year: d.year.toString(),
            [d.gender || "all"]: d.value,
          })
        }
        return acc
      }, [] as any[])
      .sort((a, b) => Number.parseInt(a.year) - Number.parseInt(b.year))
  }, [filteredData])



  const lifeExpectancyData = useMemo(() => {
    const lifeFiltered = filteredData.filter((d) => d.subcategory === "life_expectancy");
    return aggregateData(lifeFiltered, ["year", "gender"])
      .reduce((acc, d) => {
        const yearData = acc.find((item) => item.year === d.year.toString());
        if (yearData) {
          yearData[d.gender || "all"] = d.value;
        } else {
          acc.push({ year: d.year.toString(), [d.gender || "all"]: d.value });
        }
        return acc;
      }, [] as any[])
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [filteredData]);


   const povertyData = useMemo(() => {
    const povertyFiltered = filteredData.filter(d => d.subcategory.startsWith("poverty_rate"));
    return aggregateData(povertyFiltered, ["year", "subcategory"])
      .reduce((acc, d) => {
        const yearData = acc.find(item => item.year === d.year.toString());
        const type = d.subcategory.includes('rural') ? 'rural' : 'urban';
        if (yearData) {
          yearData[type] = d.value;
        } else {
          acc.push({ year: d.year.toString(), [type]: d.value });
        }
        // Add total poverty for tooltip
        if(yearData) {
            yearData.poverty = (yearData.rural || 0) + (yearData.urban || 0);
        } else {
            acc[acc.length - 1].poverty = acc[acc.length - 1][type];
        }
        return acc;
      }, [] as any[])
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [filteredData]);


   const internetAccessData = useMemo(() => {
    const internetFiltered = filteredData.filter(d => d.subcategory.startsWith("internet_access"));
    return aggregateData(internetFiltered, ["year", "subcategory"])
      .reduce((acc, d) => {
        const yearData = acc.find(item => item.year === d.year.toString());
        const type = d.subcategory.includes('rural') ? 'rural' : 'urban';
        if (yearData) {
          yearData[type] = d.value;
        } else {
          acc.push({ year: d.year.toString(), [type]: d.value });
        }
        return acc;
      }, [] as any[])
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [filteredData]);



  const humanCapitalData = useMemo(() => {
    const hciFiltered = filteredData.filter((d) => d.subcategory === "human_capital_index");
    return aggregateData(hciFiltered, ["year", "gender"])
      .reduce((acc, d) => {
        const yearData = acc.find((item) => item.year === d.year.toString());
        if (yearData) {
          yearData[d.gender || "all"] = d.value;
        } else {
          acc.push({ year: d.year.toString(), [d.gender || "all"]: d.value });
        }
        return acc;
      }, [] as any[])
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [filteredData]);








  return (
    <div className="space-y-6">
      <KPICards type="social" filters={activeFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Education by Gender */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Education Access by Gender (%)</h3>
            <ChartContainer
              config={{
                male: { label: "Male", color: "#059669" },
                female: { label: "Female", color: "#f59e0b" },
                all: { label: "Overall", color: "#8b5cf6" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={educationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend verticalAlign="top" />

                  <Line type="monotone" dataKey="male" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="female" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="all" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>

              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Health by Region */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Access by Region (%)</h3>
            <ChartContainer
              config={{
                value: { label: "Health Access", color: "#dc2626" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="region" stroke="#1e3a8a" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />

                  <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Employment Trends */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Rate Trends (%)</h3>
            <ChartContainer
              config={{
                employment: { label: "Employment Rate", color: "#06b6d4" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={employmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Area type="monotone" dataKey="employment" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Literacy by Gender */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Literacy Rate by Gender (%)</h3>
            <ChartContainer
              config={{
                male: { label: "Male", color: "#059669" },
                female: { label: "Female", color: "#f59e0b" },
                all: { label: "Overall", color: "#8b5cf6" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={literacyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" />
                  <YAxis stroke="#1e3a8a" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Area type="monotone" dataKey="male" stackId="1" stroke="#059669" fill="#059669" fillOpacity={0.6} />
                  <Area
                    type="monotone"
                    dataKey="female"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>





   {/* Life Expectancy */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Life Expectancy at Birth (Years)</h3>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lifeExpectancyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" fontSize={12} />
                  <YAxis stroke="#1e3a8a" fontSize={12} domain={[60, 80]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Line type="monotone" dataKey="all" name="Overall" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="female" name="Female" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="male" name="Male" stroke="#06b6d4" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Poverty Rate
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Poverty Rate</h3>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={povertyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" fontSize={12} />
                  <YAxis stroke="#1e3a8a" fontSize={12} domain={[0, 120]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="urban" name="Urban" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                  <Area type="monotone" dataKey="rural" name="Rural" stackId="1" stroke="#059669" fill="#059669" />
                  <Line type="monotone" dataKey="poverty" name="Poverty" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card> */}

        {/* Internet Access */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Internet Access (% of Population)</h3>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={internetAccessData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" fontSize={12} />
                  <YAxis stroke="#1e3a8a" fontSize={12} domain={[0, 24]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Line type="monotone" dataKey="urban" name="Urban" stroke="#1e3a8a" strokeWidth={2} />
                  <Line type="monotone" dataKey="rural" name="Rural" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        
        {/* Human Capital Index */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Human Capital Index (Scale 0-1)</h3>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={humanCapitalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" fontSize={12} />
                  <YAxis stroke="#1e3a8a" fontSize={12} domain={[0.15, 0.6]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Line type="monotone" dataKey="male" name="Male" stroke="#06b6d4" strokeWidth={2} />
                  <Line type="monotone" dataKey="all" name="Overall" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="female" name="Female" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Literacy Rate (Grouped Bar Chart) */}
        <Card className="bg-white shadow-lg border border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Literacy Rate (% of population 15+)</h3>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={literacyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="year" stroke="#1e3a8a" fontSize={12} />
                  <YAxis stroke="#1e3a8a" fontSize={12} domain={[20, 80]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Legend verticalAlign="top" />

                  <Bar dataKey="all" name="Overall" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="male" name="Male" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="female" name="Female" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
    


























      </div>
    </div>
  )
}
