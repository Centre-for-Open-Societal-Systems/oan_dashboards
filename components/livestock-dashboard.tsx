"use client"

// Livestock Registry view. Rendered in place of the tabbed dashboard whenever the
// Farming Type filter is set to livestock farming. Laid out as a single screen with
// no scrolling, using the same band grid and panel density as the landing overview.

import { useMemo } from "react"
import { Home, Layers, MapPinned, Milk, UserRound, Users } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useChartGroupData } from "@/hooks/use-data"
import { MapWhenVisible } from "@/components/lazy/map-when-visible"
import {
  BarList,
  BRIGHT,
  BRIGHT_SOFT,
  DeltaChip,
  EmptyPanel,
  RankList,
  REGISTRY_COLORS,
  RegistryCard,
  RegistryDonut,
  RegistryStat,
  formatCompact,
  formatFull,
} from "@/components/registry/registry-ui"
import {
  RegistryFilters,
  buildTrend,
  monthLabel,
  toNumber,
  useRegistryTrend,
} from "@/components/registry/registry-data"
import { ExportDataButton } from "@/components/registry/export-button"

const CHART_NAMES = [
  "livestockKpis",
  "livestockBySpecies",
  "farmersByRegion",
  "livestockTopWoredas",
  "landTenureSplit",
  "registryTrendByMonth",
]

const TENURE_COLORS: Record<string, string> = {
  Owner: BRIGHT.green,
  Rented: BRIGHT.amber,
  Shared: BRIGHT.tealSoft,
  Unknown: "#94A3B8",
}

export function LivestockDashboard({
  filters,
  geoJsonData,
  onMapFilterChange,
}: {
  filters: RegistryFilters
  geoJsonData?: any
  onMapFilterChange?: (filters: Record<string, string>) => void
}) {
  const { data, loading, error } = useChartGroupData(CHART_NAMES, filters as any)
  const charts = data?.data || {}

  const kpis = charts.livestockKpis?.[0] || null
  const farmers = toNumber(kpis?.farmers)
  const households = toNumber(kpis?.households)
  const femaleFarmers = toNumber(kpis?.female_farmers)
  const speciesTracked = toNumber(kpis?.species_tracked)
  const breedsTracked = toNumber(kpis?.breeds_tracked)
  const totalArea = toNumber(kpis?.total_area)
  const woredasReporting = toNumber(kpis?.woredas_reporting)
  const femaleShare = farmers > 0 ? (femaleFarmers / farmers) * 100 : 0

  const trend = useRegistryTrend(charts.registryTrendByMonth)

  const speciesRows = charts.livestockBySpecies || []
  const censusYear = speciesRows[0]?.census_year

  // Panels are height-capped in the band grid, so the longest tails are trimmed
  // rather than allowed to overflow their card.
  const speciesItems = useMemo(
    () =>
      speciesRows.slice(0, 7).map((row: any) => ({
        name: row.species,
        value: toNumber(row.population),
      })),
    [speciesRows]
  )

  const farmersByRegion = useMemo(
    () =>
      (charts.farmersByRegion || []).map((row: any) => ({
        region: row.region,
        region_code: row.region_code,
        farmers: toNumber(row.farmers),
      })),
    [charts.farmersByRegion]
  )

  const topWoredas = useMemo(
    () =>
      (charts.livestockTopWoredas || []).slice(0, 8).map((row: any) => ({
        name: row.woreda,
        value: toNumber(row.farmers),
      })),
    [charts.livestockTopWoredas]
  )

  const tenureSegments = useMemo(
    () =>
      (charts.landTenureSplit || [])
        .map((row: any) => ({
          name: row.ownership_type,
          value: toNumber(row.parcels),
          color: TENURE_COLORS[row.ownership_type] || BRIGHT.violet,
          sub: `${formatCompact(toNumber(row.area))} ha`,
        }))
        .filter((segment: { value: number }) => segment.value > 0),
    [charts.landTenureSplit]
  )

  const tenureParcels = tenureSegments.reduce((acc: number, segment: { value: number }) => acc + segment.value, 0)

  // Cumulative registrations reproduce the reference dashboard's climbing area curve.
  const registrationSeries = useMemo(() => {
    let running = 0
    return trend.series.map((point) => {
      running += point.farmers
      return { period: monthLabel(point.period), registered: running }
    })
  }, [trend.series])

  const recentRegistrations = useMemo(() => registrationSeries.slice(-12), [registrationSeries])

  const farmerTrend = buildTrend(trend.series, "farmers", { cumulative: true })
  const areaTrend = buildTrend(trend.series, "totalArea", { cumulative: true })

  if (error) {
    return (
      <RegistryCard title="Livestock Registry">
        <div className="px-4 pb-5 pt-3 text-[12px]" style={{ color: REGISTRY_COLORS.red }}>
          Failed to load registry data: {error}
        </div>
      </RegistryCard>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 @[860px]:grid @[860px]:grid-rows-[auto_auto_minmax(0,1.32fr)_minmax(0,1fr)_auto]">
      {/* Title line */}
      <header className="flex flex-none flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-[16px] font-bold leading-tight tracking-[-0.3px]" style={{ color: REGISTRY_COLORS.ink }}>
          Livestock Registry
        </h2>
        <p className="text-[11px]" style={{ color: REGISTRY_COLORS.muted }}>
          National Livestock Registry Module
        </p>
      </header>

      {/* Band 1 — KPI ribbon */}
      <section className="grid flex-none grid-cols-2 gap-3 @[640px]:grid-cols-3 @[860px]:grid-cols-[1.11fr_0.85fr_0.92fr_1.15fr_1.05fr_1.02fr]">
        <RegistryStat
          icon={<Users className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          tint="blue"
          value={formatFull(farmers)}
          label="Livestock Keepers"
          delta={farmerTrend.delta}
          loading={loading}
        />
        <RegistryStat
          icon={<Home className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          tint="green"
          value={formatFull(households)}
          label="Households"
          note={farmers > 0 ? `${((households / farmers) * 100).toFixed(1)}% of keepers` : undefined}
          loading={loading}
        />
        <RegistryStat
          icon={<Layers className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.orange}
          iconColor={BRIGHT.orange}
          tint="peach"
          value={formatFull(speciesTracked)}
          label="Species Tracked"
          note={`${formatFull(breedsTracked)} breeds`}
          loading={loading}
        />
        <RegistryStat
          icon={<MapPinned className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          tint="violet"
          value={formatCompact(totalArea)}
          unit="ha"
          label="Holding Land"
          delta={areaTrend.delta}
          loading={loading}
        />
        <RegistryStat
          icon={<UserRound className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.pink}
          iconColor={BRIGHT.pink}
          tint="pink"
          value={`${femaleShare.toFixed(1)}%`}
          label="Women Keepers"
          note={`${formatFull(femaleFarmers)} keepers`}
          loading={loading}
        />
        <RegistryStat
          icon={<Milk className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          tint="amber"
          value={formatFull(woredasReporting)}
          label="Woredas Reporting"
          note="with keepers"
          loading={loading}
        />
      </section>

      {/* Band 2 — map, species mix, tenure */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[2.6fr_1.75fr_1.55fr]">
        <RegistryCard
          dense
          title="Livestock Keepers by Region"
          subtitle={
            loading
              ? "Loading coverage…"
              : `${formatFull(woredasReporting)} woreda${woredasReporting === 1 ? "" : "s"} reporting · click to drill down`
          }
          className="flex min-h-[260px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="relative min-h-0 flex-1"
        >
          <MapWhenVisible
            fill
            legendPosition="overlay"
            className="absolute inset-0 flex flex-col"
            minHeight="100%"
            variant="registry"
            popOutTitle="Livestock Keepers by Region"
            valueLabel="keepers"
            valueFormatter={(value: number) => formatCompact(value)}
            currentFilters={{
              region: filters.region !== "all" ? filters.region : undefined,
              zone: filters.zone !== "all" ? filters.zone : undefined,
              woreda: filters.woreda !== "all" ? filters.woreda : undefined,
              farmingType: filters.farmingType !== "all" ? filters.farmingType : undefined,
            }}
            onFilterChange={(mapFilters: any) => onMapFilterChange?.(mapFilters)}
            farmerData={farmersByRegion}
            geoJsonData={geoJsonData}
          />
        </RegistryCard>

        <RegistryCard
          dense
          title="Livestock by Species"
          subtitle={censusYear ? `National herd, ${censusYear} census` : "National herd"}
          className="flex min-h-[220px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          <BarList
            dense
            items={speciesItems}
            unitLabel="Number of animals"
            formatter={(value) => formatCompact(value)}
            emptyMessage="Species census unavailable"
          />
        </RegistryCard>

        <RegistryCard
          dense
          title="Holding Tenure"
          subtitle="Holdings by ownership type"
          className="flex min-h-[220px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 items-center"
        >
          <RegistryDonut
            ringSize={96}
            className="w-full"
            segments={tenureSegments}
            centerValue={formatCompact(tenureParcels)}
            centerLabel="Holdings"
            totalLabel="Total"
            totalValue={`${formatFull(tenureParcels)} holdings`}
          />
        </RegistryCard>
      </section>

      {/* Band 3 — top woredas, registrations over time */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[860px]:grid-cols-[2fr_3.9fr]">
        <RegistryCard
          dense
          title="Top Woredas"
          className="flex min-h-[200px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          <RankList dense items={topWoredas} nameHeader="Woreda" valueHeader="Keepers" />
        </RegistryCard>

        <RegistryCard
          dense
          title="Registrations Over Time"
          subtitle="Cumulative registered livestock keepers"
          actions={farmerTrend.delta ? <DeltaChip delta={farmerTrend.delta} /> : undefined}
          className="flex min-h-[220px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {recentRegistrations.length === 0 ? (
            <EmptyPanel message="No registrations in range" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentRegistrations} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="livestockRegistrations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.blueSoft} stopOpacity={0.38} />
                    <stop offset="100%" stopColor={BRIGHT.blueSoft} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip
                  cursor={{ stroke: REGISTRY_COLORS.line, strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: 10,
                    border: `1px solid ${REGISTRY_COLORS.line}`,
                    fontSize: 11,
                  }}
                  formatter={(value: any) => [formatFull(toNumber(value)), "Registered keepers"]}
                />
                <Area
                  type="monotone"
                  dataKey="registered"
                  stroke={BRIGHT.blue}
                  strokeWidth={2}
                  fill="url(#livestockRegistrations)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.blue, strokeWidth: 1.4 }}
                  activeDot={{ r: 3.5, fill: BRIGHT.blue, stroke: "#fff", strokeWidth: 1.6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>
      </section>

      {/* Source ribbon */}
      <div
        className="flex flex-none items-center gap-2 rounded-xl border bg-white px-4 py-1 text-[10.5px]"
        style={{ borderColor: REGISTRY_COLORS.line, color: REGISTRY_COLORS.muted }}
      >
        <Layers className="h-3.5 w-3.5 flex-none" style={{ color: BRIGHT.teal }} />
        <span className="min-w-0 flex-1 truncate">
          Boundaries: geoBoundaries gbOpen ETH ADM1/ADM3 (CC BY 4.0). Species totals come from the national livestock
          census and are not filtered by area.
        </span>
        <ExportDataButton
          filters={filters}
          filePrefix="livestock-registry"
          captureTargetId="tab-content-livestock-registry"
        />
      </div>
    </div>
  )
}
