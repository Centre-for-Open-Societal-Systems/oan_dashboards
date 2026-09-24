// hooks/use-data.ts
// Updated hooks for new chart-based architecture
import React, { useState, useEffect, useCallback } from 'react'
import { ChartDataResult, AllChartsResult } from '@/lib/chart-data-service'
// Lightweight client-safe cache for chart groups (avoids pulling server cache code into bundle)
const chartGroupCache = new Map<string, ChartGroupResult>()

interface ChartFilters {
  region?: string
  gender?: string
  farmingType?: string
  dateFrom?: string
  dateTo?: string
  sector?: string
  timePeriod?: string
}

interface UseSingleChartResult {
  data: any[]
  loading: boolean
  error: string | null
  executionTime?: number
  refetch: () => Promise<void>
}

interface UseAllChartsResult {
  charts: Record<string, ChartDataResult>
  loading: boolean
  error: string | null
  summary: {
    total: number
    successful: number
    failed: number
    totalExecutionTime: number
  } | null
  refetch: () => Promise<void>
}

export interface ChartGroupResult {
  success: boolean
  data: Record<string, any[]>
  errors: Array<{ chart: string; error: string | null }>
  summary: {
    total: number
    successful: number
    failed: number
    totalExecutionTime: number
  }
}

interface UseChartGroupResult {
  data: ChartGroupResult | null
  loading: boolean
  error: string | null
}

// Hook for fetching a single chart's data
export function useSingleChart(chartId: string, filters?: ChartFilters): UseSingleChartResult {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number | undefined>()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== 'all') {
            params.append(key, value)
          }
        })
      }


      const response = await fetch(`/api/charts/${chartId}?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()


      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch chart data')
      }

      setData(result.data)
      setExecutionTime(result.executionTime)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error(`Error fetching chart ${chartId}:`, err)
    } finally {
      setLoading(false)
    }
  }, [chartId, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    executionTime,
    refetch: fetchData,
  }
}

// Hook for fetching all charts in parallel
export function useAllCharts(filters?: ChartFilters, usePriority: boolean = false): UseAllChartsResult {
  const [charts, setCharts] = useState<Record<string, ChartDataResult>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    total: number
    successful: number
    failed: number
    totalExecutionTime: number
  } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== 'all') {
            params.append(key, value)
          }
        })
      }

      if (usePriority) {
        params.append('priority', 'true')
      }


      const response = await fetch(`/api/charts?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()


      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch charts data')
      }

      setCharts(result.data)
      setSummary(result.summary)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching all charts:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, usePriority])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    charts,
    loading,
    error,
    summary,
    refetch: fetchData,
  }
}

// Fetch a small set of charts together (used by tabs) with simple caching
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
      } catch (err: any) {
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
  }, [cacheKey, chartKey])

  return { data, loading, error }
}

// Main useData hook for backward compatibility with original UI
export function useData(filters?: {
  dateRange?: { from: Date; to: Date }
  region?: string
  sector?: string
  gender?: string
  timePeriod?: string
}) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== 'all') {
            if (key === 'dateRange' && typeof value === 'object' && 'from' in value && 'to' in value) {
              params.append('dateFrom', value.from.toISOString())
              params.append('dateTo', value.to.toISOString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })
      }

      const response = await fetch(`/api/data?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch data')
      }

      setData(result.data)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    sourceInfo: {
      source: 'database',
      isDatabaseAvailable: true,
      cacheStatus: 'fresh'
    },
    refetch: fetchData,
    clearCache: fetchData
  }
}

// Specific hooks for each chart component
export function useFarmersByRegion(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('farmersByRegion', chartFilters)
}

export function useFarmersByType(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('farmersByType', chartFilters)
}

export function useFarmerKPIs(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('farmerKPIs', chartFilters)
}

export function useGenderDistribution(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('genderDistribution', chartFilters)
}

export function useLandAreaByRegion(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('landAreaByRegion', chartFilters)
}

export function useAvgFarmSizeByType(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('avgFarmSizeByType', chartFilters)
}

export function useIncomeDistribution(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('incomeDistribution', chartFilters)
}

export function useRegistrationTimeline(filters?: any) {
  const chartFilters = convertFilters(filters)
  return useSingleChart('registrationTimeline', chartFilters)
}

// Helper function to convert old filter format to new format
function convertFilters(filters?: any): ChartFilters {
  if (!filters) return {}

  return {
    region: filters.region !== "all" ? filters.region : undefined,
    gender: filters.gender !== "all" ? filters.gender : undefined,
    sector: filters.sector !== "all" ? filters.sector : undefined,
    dateFrom: filters.dateRange?.from?.toISOString().split('T')[0],
    dateTo: filters.dateRange?.to?.toISOString().split('T')[0],
    timePeriod: filters.timePeriod !== "all" ? filters.timePeriod : undefined,
  }
}

// Legacy hook for backward compatibility - now uses single chart hook
export function useStats(filters?: ChartFilters) {
  return useSingleChart('farmersByType', filters)
}

// Legacy hook for backward compatibility - now uses single chart hook
export function useAggregatedData(chartId: string, filters?: ChartFilters) {
  return useSingleChart(chartId, filters)
}
