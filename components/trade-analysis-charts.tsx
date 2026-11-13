// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { KPICards } from "@/components/kpi-cards"

interface TradeData {
  year: string
  imports?: number
  exports?: number
  region?: string
  percentage?: number
  value?: number
  rate?: number
  category?: string
}

const COLORS = ["#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

export function TradeAnalysisCharts() {
  const [merchandiseImportsData, setMerchandiseImportsData] = useState<TradeData[]>([])
  const [regionalTradeData, setRegionalTradeData] = useState<TradeData[]>([])
  const [highTechExportsData, setHighTechExportsData] = useState<TradeData[]>([])
  const [tariffRatesData, setTariffRatesData] = useState<TradeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Show error instead of mock data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError("Trade analysis data is not available in the current database. Please configure trade indicators in your database to display this data.")


        // Clear all data since we're showing error
        setMerchandiseImportsData([])
        setRegionalTradeData([])
        setHighTechExportsData([])
        setTariffRatesData([])
        
      } catch (err) {
        console.error('❌ Error fetching trade analysis chart data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <KPICards />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading trade analysis data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <KPICards />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <p className="text-red-600 font-semibold">Error loading data</p>
            <p className="text-gray-600 text-sm mt-2">{error}</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <KPICards />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white/80 backdrop-blur-sm border border-purple-200">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Trade Overview
          </TabsTrigger>
          <TabsTrigger value="regional" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Regional Analysis
          </TabsTrigger>
          <TabsTrigger value="technology" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Technology Trade
          </TabsTrigger>
          <TabsTrigger value="tariffs" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Tariff Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200 col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-purple-800">Merchandise Trade Balance (Million USD)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT year, imports, exports FROM trade_data WHERE country_code = 'ETH' AND year {">"}= 2020
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    imports: {
                      label: "Imports",
                      color: "#7C3AED",
                    },
                    exports: {
                      label: "Exports",
                      color: "#10B981",
                    },
                  }}
                  className="h-[400px] w-full"
                >
                  <AreaChart data={merchandiseImportsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="imports"
                      stackId="1"
                      stroke="#7C3AED"
                      fill="#7C3AED"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="exports"
                      stackId="2"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="regional">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Regional Trade Distribution (%)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT region, SUM(trade_value) as value, AVG(percentage) as percentage FROM regional_trade
                  WHERE country_code = 'ETH' GROUP BY region
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    value: {
                      label: "Trade Value",
                      color: "#7C3AED",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <PieChart>
                    <Pie
                      data={regionalTradeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="percentage"
                      label={({ region, percentage }) => `${region}: ${percentage}%`}
                    >
                      {regionalTradeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="technology">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">High-Technology Exports (Million USD)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT year, high_tech_exports FROM tech_exports WHERE country_code = 'ETH' AND year {">"}=
                  2019
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    value: {
                      label: "High-Tech Exports",
                      color: "#7C3AED",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <LineChart data={highTechExportsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#7C3AED"
                      strokeWidth={3}
                      dot={{ fill: "#7C3AED", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tariffs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Most Favored Nation Tariff Rates (%)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT category, tariff_rate FROM tariff_data WHERE country_code = 'ETH' AND year = 2024
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    rate: {
                      label: "Tariff Rate (%)",
                      color: "#7C3AED",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <BarChart data={tariffRatesData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#6B7280" />
                    <YAxis dataKey="category" type="category" width={120} stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="rate" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
