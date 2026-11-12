// Public aggregate-dashboard filters; no registry SQL or database fallback.
export interface ChartFilters {
  provider?: string
  region?: string
  zone?: string
  woreda?: string
  kebele?: string
  category?: string
}
