import { Elysia } from "elysia"
import { DASHBOARD_SERVICES, getServiceChart, serviceConfigured, serviceForChart } from "./dashboard-services"
import type { ChartFilters } from "@/lib/chart-queries"

const FILTERS = ["provider", "region", "zone", "woreda", "kebele", "category"] as const
const filtersFor = (query: Record<string, unknown>): ChartFilters => Object.fromEntries(
  FILTERS.flatMap(key => typeof query[key] === "string" && query[key] && query[key] !== "all" ? [[key, query[key]]] : []),
)

export function createElysiaApp(prefix = "/api") {
  return new Elysia({ prefix })
    .get("/health", () => ({ status: "ok" }))
    .get("/config", () => ({ dashboards: [
      ...(serviceConfigured("a2c") ? ["a2c"] : []),
      ...(serviceConfigured("grievance") ? ["grievance"] : []),
    ] }))
    .get("/charts", async ({ query, set }) => {
      const requested = String(query.charts || "").split(",").filter(Boolean)
      const ids = requested.length ? requested : DASHBOARD_SERVICES.filter(service => serviceConfigured(service.id)).flatMap(service => service.charts)
      // Reject the entire batch before accessing any upstream or cache.
      if (ids.some(id => !serviceForChart(id))) {
        set.status = 404
        return { success: false, error: "Unknown chart" }
      }
      const filters = filtersFor(query)
      const results = await Promise.all(ids.map(async chartName => {
        try { return [chartName, { success: true, data: await getServiceChart(chartName, filters), error: null }] as const }
        catch (error) { return [chartName, { success: false, data: [], error: error instanceof Error ? error.message : "Chart unavailable" }] as const }
      }))
      const failed = results.filter(([, result]) => !result.success).length
      return { success: true, data: Object.fromEntries(results), summary: { total: ids.length, successful: ids.length - failed, failed }, filters }
    })
    .get("/charts/:chartId", async ({ params, query, set }) => {
      if (!serviceForChart(params.chartId)) {
        set.status = 404
        return { success: false, error: "Unknown chart" }
      }
      try { return { chartName: params.chartId, success: true, data: await getServiceChart(params.chartId, filtersFor(query)), error: null } }
      catch (error) {
        set.status = 502
        return { success: false, error: error instanceof Error ? error.message : "Chart unavailable" }
      }
    })
}
