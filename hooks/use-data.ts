"use client"
import { useEffect, useState } from "react"

interface ChartGroupResult {
  success: boolean
  // Aggregate row columns are defined by each upstream chart contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, Record<string, any>[]>
  errors: { chart: string; error: string }[]
  summary: { total: number; successful: number; failed: number; totalExecutionTime: number }
}
interface UseChartGroupResult { data: ChartGroupResult | null; loading: boolean; error: string | null }

export function useChartGroupData(
  chartNames: string[],
  filters: Record<string, string>,
  initialData?: ChartGroupResult | null
): UseChartGroupResult {
  const [data, setData] = useState<ChartGroupResult | null>(initialData || null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  // Serialize inputs to stable keys
  const chartKey = chartNames.join(',')
  const cleanedFilters = Object.fromEntries(
    Object.entries(filters || {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== 'all'
    )
  )
  const cacheKey = `chart-group:${chartKey}:${JSON.stringify(cleanedFilters)}`

  useEffect(() => {
    let cancelled = false

    const fetchCharts = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set('charts', chartKey)
        Object.entries(cleanedFilters).forEach(([key, value]) => {
          if (value) params.append(key, value as string)
        })

        const response = await fetch(`/api/charts?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`)
        }
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch charts')
        }

        const mapped: ChartGroupResult = {
          success: true,
          data: {},
          errors: [],
          summary: result.summary || { total: chartNames.length, successful: 0, failed: 0, totalExecutionTime: 0 },
        }

        chartNames.forEach(name => {
          const entry = result.data?.[name]
          mapped.data[name] = entry?.data || []
          if (!entry?.success) {
            mapped.errors.push({ chart: name, error: entry?.error || 'Unknown error' })
          }
        })

        mapped.summary.successful = chartNames.length - mapped.errors.length
        mapped.summary.failed = mapped.errors.length

        if (!cancelled) {
          setData(mapped)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCharts()
    return () => {
      cancelled = true
    }
  // Values are serialized in cacheKey; chartNames and cleanedFilters have identical contents.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, chartKey])

  return { data, loading, error }
}
