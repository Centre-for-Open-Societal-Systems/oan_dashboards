"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { KPICards } from "@/components/kpi-cards"

const tourismExpenditureData = [
  { year: "2019", expenditure: 661, receipts: 3.8 },
  { year: "2020", expenditure: 322, receipts: 1.2 },
  { year: "2021", expenditure: 356, receipts: 1.8 },
  { year: "2022", expenditure: 461, receipts: 2.4 },
  { year: "2023", expenditure: 612, receipts: 3.1 },
  { year: "2024", expenditure: 580, receipts: 2.9 },
]

const travelServicesData = [
  { year: "2019", percentage: 9.99 },
  { year: "2020", percentage: 10.88 },
  { year: "2021", percentage: 5.99 },
  { year: "2022", percentage: 9.83 },
  { year: "2023", percentage: 7.11 },
  { year: "2024", percentage: 8.48 },
]

const insuranceFinancialData = [
  { year: "2019", percentage: 4.36 },
  { year: "2020", percentage: 3.43 },
  { year: "2021", percentage: 4.01 },
  { year: "2022", percentage: 4.27 },
  { year: "2023", percentage: 4.11 },
  { year: "2024", percentage: 3.75 },
]

const servicesSectorData = [
  { category: "Travel Services", value: 8.48, growth: 19.3 },
  { category: "Insurance & Financial", value: 3.75, growth: -8.8 },
  { category: "Transport Services", value: 12.4, growth: 5.2 },
  { category: "Communication Services", value: 2.1, growth: 15.7 },
  { category: "Other Business Services", value: 18.9, growth: 7.4 },
]

export function TourismFinanceCharts() {
  return (
    <div className="space-y-6">
      <KPICards />

      <Tabs defaultValue="tourism" className="space-y-4">
        <TabsList className="bg-white/80 backdrop-blur-sm border border-purple-200">
          <TabsTrigger value="tourism" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Tourism Analysis
          </TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Service Sectors
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Financial Services
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tourism">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200 col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-purple-800">Tourism Expenditure vs Receipts</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT year, tourism_expenditure, tourism_receipts FROM tourism_data WHERE country_code = 'ETH'
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    expenditure: {
                      label: "Expenditure (Million USD)",
                      color: "#7C3AED",
                    },
                    receipts: {
                      label: "Receipts (% of exports)",
                      color: "#10B981",
                    },
                  }}
                  className="h-[400px] w-full"
                >
                  <LineChart data={tourismExpenditureData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" />
                    <YAxis yAxisId="left" stroke="#6B7280" />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="expenditure"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      dot={{ fill: "#7C3AED" }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="receipts"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: "#10B981" }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Travel Services (% of commercial service imports)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT year, travel_services_percentage FROM services_data WHERE country_code = 'ETH'
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    percentage: {
                      label: "Travel Services %",
                      color: "#7C3AED",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <AreaChart data={travelServicesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="percentage" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.6} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-800">Services Sector Performance (2024)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT service_category, current_value, growth_rate FROM services_overview WHERE country_code =
                  'ETH' AND year = 2024
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    value: {
                      label: "Current Value (%)",
                      color: "#10B981",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <BarChart data={servicesSectorData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#6B7280" />
                    <YAxis dataKey="category" type="category" width={120} stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/90 backdrop-blur-sm shadow-lg border border-purple-200 col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-purple-800">Insurance & Financial Services (%)</CardTitle>
                {/* <CardDescription className="text-purple-600">
                  Query: SELECT year, insurance_financial_percentage FROM financial_services WHERE country_code = 'ETH'
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    percentage: {
                      label: "Insurance & Financial %",
                      color: "#7C3AED",
                    },
                  }}
                  className="h-[400px] w-full"
                >
                  <BarChart data={insuranceFinancialData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="percentage" fill="#7C3AED" radius={[4, 4, 0, 0]} />
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
