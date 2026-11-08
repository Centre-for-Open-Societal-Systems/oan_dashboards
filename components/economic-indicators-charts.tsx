"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { KPICards } from "@/components/kpi-cards"

interface EconomicIndicatorsChartsProps {
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

export function EconomicIndicatorsCharts({
  dateRange,
  selectedRegion,
  selectedIndicator,
  filters,
}: EconomicIndicatorsChartsProps) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(
      "Economic indicators data is not available in the current database. Please configure economic indicators in your database to display this data."
    )
  }, [])

  const activeFilters =
    filters ||
    ({
      dateRange,
      region: selectedRegion,
      sector: "all",
      gender: "all",
      timePeriod: "all",
    } as const)

  return (
    <div className="space-y-6">
      <KPICards type="economic" filters={activeFilters} />

      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Economic Indicators Not Available</h3>
            <p className="text-red-600">
              {error ||
                "Economic indicators data is not available in the current database. Please configure economic indicators to display this data."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
