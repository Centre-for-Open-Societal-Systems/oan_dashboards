"use client"

// Grievance redress view: how many grievances farmers lodge, how fast officers
// resolve them, and where the SLA is slipping.
//
// Data comes from the grievance service's public chart API, which answers from
// rollups it refreshes every 15 minutes. Every figure is a count; no grievance
// text, ticket or person ever reaches this dashboard. It is filtered by region
// and service category only, so the sidebar shows its own two filters.

import { useMemo } from "react"
import {
  AlarmClock,
  AlertTriangle,
  BadgeCheck,
  CircleHelp,
  CircleAlert,
  ClipboardList,
  Copy,
  Gauge,
  Hourglass,
  Inbox,
  Landmark,
  MapPin,
  PieChart,
  ShieldAlert,
  Smile,
  Sprout,
  Store,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useChartGroupData } from "@/hooks/use-data"
import type { GrievanceFilters } from "@/hooks/use-grievance-filters"
import {
  BRIGHT,
  BRIGHT_SERIES,
  BRIGHT_SOFT,
  EmptyPanel,
  InlineLegend,
  ProgressRow,
  REGISTRY_COLORS,
  RegistryCard,
  RegistryDonut,
  RegistryStat,
  SegmentRow,
  SplitBar,
  formatCompact,
  formatFull,
} from "@/components/registry/registry-ui"
import { toNumber } from "@/components/registry/registry-data"
import { ExportDataButton } from "@/components/registry/export-button"

const CHART_NAMES = [
  "grvKpis",
  "grvPerformanceKpis",
  "grvMonthlyTrend",
  "grvWeeklyTrend",
  "grvNetBacklogTrend",
  "grvStatusDistribution",
  "grvByCategory",
  "grvCategoryResolution",
  "grvResolutionRateByRegion",
  "grvSlaRisk",
  "grvPendingDuplicates",
  "grvOldestOpen",
]

const STATUS_COLORS: Record<string, string> = {
  Submitted: BRIGHT.blue,
  Assigned: BRIGHT.sky,
  "In Progress": BRIGHT.violet,
  "More Info Needed": BRIGHT.amber,
  Resolved: BRIGHT.green,
  Closed: BRIGHT.tealSoft,
  Rejected: BRIGHT.red,
}

/** Service categories, glyphed by the part of farming they concern. */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Inputs: <Sprout className="h-3 w-3" />,
  Schemes: <ClipboardList className="h-3 w-3" />,
  Payments: <Wallet className="h-3 w-3" />,
  Credit: <Landmark className="h-3 w-3" />,
  Markets: <Store className="h-3 w-3" />,
  Other: <CircleHelp className="h-3 w-3" />,
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-04" -> "Apr 26" */
function monthLabel(key: string) {
  const [year, month] = key.split("-")
  return `${MONTHS[Number(month) - 1] ?? month} ${year?.slice(2) ?? ""}`
}

/** "2026-09-14" -> "14 Sep" */
function weekLabel(key: string) {
  const [, month, day] = key.split("-")
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month}`
}

/** One row of a chart, as the grievance service returns it. */
type Row = Record<string, unknown>

function signed(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`
}

export function GrievanceDashboard({ filters }: { filters: GrievanceFilters }) {
  const { data, loading, error } = useChartGroupData(CHART_NAMES, filters)
  const charts = data?.data || {}

  const kpis = useMemo(() => {
    const byMetric: Record<string, Row> = {}
    ;(charts.grvKpis || []).forEach((row: Row) => {
      byMetric[String(row.metric)] = row
    })
    return byMetric
  }, [charts.grvKpis])

  const total = toNumber(kpis.total?.value)
  const totalDeltaPct = kpis.total?.delta_pct
  const awaiting = toNumber(kpis.awaiting_action?.value)
  const newThisWeek = toNumber(kpis.awaiting_action?.delta)
  const resolved = toNumber(kpis.resolved?.value)
  const resolvedThisWeek = toNumber(kpis.resolved?.delta)
  const escalated = toNumber(kpis.escalated?.value)

  const risk = useMemo(() => {
    const byBucket: Record<string, number> = {}
    ;(charts.grvSlaRisk || []).forEach((row: Row) => {
      byBucket[String(row.bucket)] = toNumber(row.count)
    })
    return byBucket
  }, [charts.grvSlaRisk])
  const atRisk = risk.at_risk || 0
  const breached = risk.breached || 0

  const pendingDuplicates = toNumber(charts.grvPendingDuplicates?.[0]?.count)
  const oldestOpenDays = charts.grvOldestOpen?.[0] ? toNumber(charts.grvOldestOpen[0].age_days) : null

  const performance = useMemo(() => {
    const byMetric: Record<string, Row> = {}
    ;(charts.grvPerformanceKpis || []).forEach((row: Row) => {
      byMetric[String(row.metric)] = row
    })
    return byMetric
  }, [charts.grvPerformanceKpis])
  const avgResolution = performance.avg_resolution_time
  const resolutionRate = performance.resolution_rate
  const escalationRate = performance.escalation_rate
  const satisfaction = performance.satisfaction

  // The monthly trend and the backlog cover the same six months; one chart shows both.
  const trend = useMemo(() => {
    const backlog = new Map<string, number>()
    ;(charts.grvNetBacklogTrend || []).forEach((row: Row) => backlog.set(String(row.period), toNumber(row.backlog)))
    return (charts.grvMonthlyTrend || []).map((row: Row) => ({
      month: monthLabel(String(row.month)),
      submitted: toNumber(row.submitted),
      resolved: toNumber(row.resolved),
      backlog: backlog.get(String(row.month)) ?? null,
    }))
  }, [charts.grvMonthlyTrend, charts.grvNetBacklogTrend])

  const weekly = useMemo(
    () =>
      (charts.grvWeeklyTrend || []).map((row: Row) => ({
        week: weekLabel(String(row.week_start)),
        received: toNumber(row.received),
        resolved: toNumber(row.resolved),
      })),
    [charts.grvWeeklyTrend]
  )

  const statusSegments = useMemo(
    () =>
      (charts.grvStatusDistribution || [])
        .map((row: Row) => ({
          name: String(row.status),
          value: toNumber(row.count),
          sub: formatFull(toNumber(row.count)),
          color: STATUS_COLORS[String(row.status)] || BRIGHT.blue,
        }))
        .filter((segment: { value: number }) => segment.value > 0),
    [charts.grvStatusDistribution]
  )

  const categories = useMemo(
    () =>
      (charts.grvByCategory || []).map((row: Row) => ({
        name: String(row.category),
        count: toNumber(row.count),
      })),
    [charts.grvByCategory]
  )
  const categoryMax = categories.reduce((acc: number, row: { count: number }) => Math.max(acc, row.count), 0)

  const categoryResolution = useMemo(
    () =>
      (charts.grvCategoryResolution || []).map((row: Row) => ({
        name: String(row.category),
        filed: toNumber(row.filed),
        resolved: toNumber(row.resolved),
        onTime: toNumber(row.resolved_on_time),
        late: toNumber(row.resolved_breached),
      })),
    [charts.grvCategoryResolution]
  )

  const regions = useMemo(
    () =>
      (charts.grvResolutionRateByRegion || []).map((row: Row) => ({
        name: String(row.region_name || row.region_code),
        resolved: toNumber(row.resolved),
        total: toNumber(row.total),
        rate: toNumber(row.rate),
      })),
    [charts.grvResolutionRateByRegion]
  )

  if (error) {
    return (
      <RegistryCard title="Grievance Redress">
        <div className="px-4 pb-5 pt-3 text-[12px]" style={{ color: REGISTRY_COLORS.red }}>
          Failed to load grievance data: {error}
        </div>
      </RegistryCard>
    )
  }

  const needsAttention = escalated > 0 || breached > 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 @[860px]:grid @[860px]:grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
      {/* Band 1 — the caseload and where it stands */}
      <section className="grid flex-none grid-cols-2 gap-3 @[640px]:grid-cols-4 @[1180px]:grid-cols-8">
        <RegistryStat
          icon={<Inbox className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          tint="blue"
          size="lg"
          value={formatFull(total)}
          label="Total Grievances"
          note={
            totalDeltaPct === null || totalDeltaPct === undefined
              ? "No earlier month to compare"
              : `${signed(toNumber(totalDeltaPct))}% from last month`
          }
          loading={loading}
        />
        <RegistryStat
          icon={<Hourglass className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          tint="violet"
          size="lg"
          value={formatFull(awaiting)}
          label="Awaiting Action"
          note={`+${formatFull(newThisWeek)} new this week`}
          loading={loading}
        />
        <RegistryStat
          icon={<BadgeCheck className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          tint="green"
          size="lg"
          value={formatFull(resolved)}
          label="Resolved"
          note={`+${formatFull(resolvedThisWeek)} resolved this week`}
          loading={loading}
        />
        <RegistryStat
          icon={<ShieldAlert className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          tint={escalated > 0 ? "red" : "green"}
          size="lg"
          value={formatFull(escalated)}
          valueColor={escalated > 0 ? BRIGHT.crimson : undefined}
          label="Escalated"
          note="Open cases past an SLA trigger"
          loading={loading}
        />
        <RegistryStat
          icon={<AlarmClock className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          tint="amber"
          size="lg"
          value={formatFull(atRisk)}
          label="Due Today / At Risk"
          note="SLA deadline within 24 hours"
          loading={loading}
        />
        <RegistryStat
          icon={<AlertTriangle className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          tint={breached > 0 ? "red" : "green"}
          size="lg"
          value={formatFull(breached)}
          valueColor={breached > 0 ? BRIGHT.crimson : undefined}
          label="SLA Breached"
          note="Open cases past their deadline"
          loading={loading}
        />
        <RegistryStat
          icon={<Copy className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.sky}
          iconColor={BRIGHT.sky}
          tint="teal"
          size="lg"
          value={formatFull(pendingDuplicates)}
          label="Pending Duplicate Review"
          note="Flagged, awaiting an officer"
          loading={loading}
        />
        <RegistryStat
          icon={<Timer className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.orange}
          iconColor={BRIGHT.orange}
          tint="peach"
          size="lg"
          value={oldestOpenDays === null ? "—" : formatFull(oldestOpenDays)}
          unit={oldestOpenDays === null ? undefined : "days"}
          label="Oldest Open Case"
          note="Longest open, not escalated"
          loading={loading}
        />
      </section>

      {/* Escalation banner — only when something needs a senior officer */}
      {needsAttention && !loading ? (
        <div
          className="flex flex-none items-center gap-2 rounded-xl border px-4 py-1.5 text-[11.5px]"
          style={{ borderColor: "#F4C0C0", background: "#FEF6F6", color: "#7F1D1D" }}
        >
          <ShieldAlert className="h-4 w-4 flex-none" />
          <strong className="font-semibold">
            {formatFull(escalated)} escalated grievance{escalated === 1 ? "" : "s"} require
            {escalated === 1 ? "s" : ""} senior officer attention
          </strong>
          <span className="min-w-0 flex-1 truncate">
            · {formatFull(breached)} past the SLA deadline · {formatFull(atRisk)} due within 24 hours
          </span>
        </div>
      ) : (
        <div className="hidden @[860px]:block" />
      )}

      {/* Band 2 — volume over time, where cases stand, how well they are handled */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[3fr_2fr_2.2fr]">
        <RegistryCard
          dense
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="Monthly Submission & Resolution Trend"
          subtitle="Filed and resolved per month · line: open backlog at month end"
          actions={
            <InlineLegend
              items={[
                { name: "Submitted", color: BRIGHT.blueSoft },
                { name: "Resolved", color: BRIGHT.greenSoft },
                { name: "Backlog", color: BRIGHT.orange },
              ]}
            />
          }
          className="flex min-h-[240px] flex-col @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {trend.length === 0 ? (
            <EmptyPanel message="No grievances in the last six months" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 6, right: 10, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${REGISTRY_COLORS.line}`, fontSize: 11 }}
                  formatter={(value: unknown, name: unknown) => [
                    formatFull(toNumber(value)),
                    name === "submitted" ? "Submitted" : name === "resolved" ? "Resolved" : "Open backlog",
                  ]}
                />
                <Bar dataKey="submitted" fill={BRIGHT.blueSoft} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="resolved" fill={BRIGHT.greenSoft} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line
                  type="monotone"
                  dataKey="backlog"
                  stroke={BRIGHT.orange}
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#fff", stroke: BRIGHT.orange, strokeWidth: 1.4 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<PieChart className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          title="Status Distribution"
          subtitle={`${formatFull(total)} grievances across the workflow`}
          className="flex min-h-[220px] flex-col @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 items-center"
        >
          <RegistryDonut
            subInline
            ringSize={104}
            className="w-full"
            segments={statusSegments}
            centerValue={formatFull(total)}
            centerLabel="Total"
            totalLabel="Open"
            totalValue={formatFull(awaiting + (statusSegments.find((s) => s.name === "More Info Needed")?.value || 0))}
          />
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Gauge className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.teal}
          title="Performance This Month"
          subtitle="Change against last month"
          className="flex min-h-0 flex-col"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[10px] px-3 pb-2.5 pt-2"
        >
          <SegmentRow
            icon={<Timer className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.blue}
            iconColor={BRIGHT.blue}
            label="Avg resolution time"
            value={avgResolution?.value === null || avgResolution?.value === undefined ? "—" : `${toNumber(avgResolution.value).toFixed(1)} d`}
            share={avgResolution?.delta === null || avgResolution?.delta === undefined ? undefined : `(${signed(toNumber(avgResolution.delta))} d)`}
          />
          <SegmentRow
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.green}
            iconColor={BRIGHT.green}
            label="Resolution rate"
            value={resolutionRate?.value === null || resolutionRate?.value === undefined ? "—" : `${toNumber(resolutionRate.value).toFixed(1)}%`}
            share={resolutionRate?.delta === null || resolutionRate?.delta === undefined ? undefined : `(${signed(toNumber(resolutionRate.delta))} pts)`}
          />
          <SegmentRow
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.red}
            iconColor={BRIGHT.crimson}
            label="Escalation rate"
            value={escalationRate?.value === null || escalationRate?.value === undefined ? "—" : `${toNumber(escalationRate.value).toFixed(1)}%`}
            share={escalationRate?.delta === null || escalationRate?.delta === undefined ? undefined : `(${signed(toNumber(escalationRate.delta))} pts)`}
          />
          <SegmentRow
            icon={<Smile className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.amber}
            iconColor={BRIGHT.amber}
            label="Farmer satisfaction"
            value={satisfaction?.value === null || satisfaction?.value === undefined ? "—" : `${toNumber(satisfaction.value).toFixed(1)}%`}
            share={`(${formatFull(toNumber(satisfaction?.basis))} responses)`}
          />
        </RegistryCard>
      </section>

      {/* Band 3 — categories, SLA outcome, regions, the last few weeks */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[2fr_2.4fr_2fr_2.4fr]">
        <RegistryCard
          dense
          icon={<ClipboardList className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="By Service Category"
          subtitle="Grievances lodged per category"
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {categories.length === 0 ? (
            <EmptyPanel message="No grievances for the current filters" />
          ) : (
            categories.map((row, index) => (
              <ProgressRow
                key={row.name}
                icon={CATEGORY_ICONS[row.name] || <ClipboardList className="h-3 w-3" />}
                iconColor={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                label={row.name}
                value={formatFull(row.count)}
                percent={categoryMax > 0 ? (row.count / categoryMax) * 100 : 0}
                color={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                barWidth="56px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<CircleAlert className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          title="Resolved On Time vs Breached"
          subtitle="Last six months, by service category"
          actions={
            <InlineLegend
              items={[
                { name: "On time", color: BRIGHT.green },
                { name: "Breached", color: BRIGHT.crimson },
              ]}
            />
          }
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[8px] px-3 pb-2.5 pt-2"
        >
          {categoryResolution.every((row) => row.onTime + row.late === 0) ? (
            <EmptyPanel message="Nothing resolved in this period" />
          ) : (
            categoryResolution
              .filter((row) => row.onTime + row.late > 0)
              .map((row) => (
                <div key={row.name} className="grid gap-1">
                  <div className="flex items-baseline justify-between text-[10.5px]" style={{ color: REGISTRY_COLORS.ink2 }}>
                    <span className="flex items-center gap-1.5">
                      <span style={{ color: REGISTRY_COLORS.muted }}>
                        {CATEGORY_ICONS[row.name] || <ClipboardList className="h-3 w-3" />}
                      </span>
                      {row.name}
                    </span>
                    <span className="font-semibold" style={{ color: REGISTRY_COLORS.ink }}>
                      {formatFull(row.onTime)} on time · {formatFull(row.late)} late
                    </span>
                  </div>
                  <SplitBar
                    segments={[
                      { name: "On time", value: row.onTime, color: BRIGHT.green },
                      { name: "Breached", value: row.late, color: BRIGHT.crimson },
                    ]}
                  />
                </div>
              ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<MapPin className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.teal}
          title="Resolution Rate by Region"
          subtitle="Resolved or closed, of all grievances"
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {regions.length === 0 ? (
            <EmptyPanel message="No grievances for the current filters" />
          ) : (
            regions.map((row) => (
              <ProgressRow
                key={row.name}
                icon={<MapPin className="h-3 w-3" />}
                iconColor={BRIGHT.teal}
                label={`${row.name} · ${formatFull(row.total)}`}
                value={`${row.rate.toFixed(1)}%`}
                percent={row.rate}
                color={BRIGHT.tealSoft}
                barWidth="56px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          title="Weekly Received vs Resolved"
          subtitle="The last seven weeks"
          className="flex min-h-[200px] flex-col @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {weekly.length === 0 ? (
            <EmptyPanel message="No recent grievances" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grv-received-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.blueSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.blueSoft} stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="grv-resolved-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.greenSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.greenSoft} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="week"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={14}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={26}
                  allowDecimals={false}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${REGISTRY_COLORS.line}`, fontSize: 11 }}
                  formatter={(value: unknown, name: unknown) => [
                    formatFull(toNumber(value)),
                    name === "received" ? "Received" : "Resolved",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke={BRIGHT.blue}
                  strokeWidth={2}
                  fill="url(#grv-received-trend)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.blue, strokeWidth: 1.4 }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke={BRIGHT.green}
                  strokeWidth={2}
                  fill="url(#grv-resolved-trend)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.green, strokeWidth: 1.4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>
      </section>

      {/* Source ribbon */}
      <div
        className="flex flex-none items-center gap-2 rounded-xl border px-4 py-1 text-[11px]"
        style={{ borderColor: REGISTRY_COLORS.line, background: "#fff", color: REGISTRY_COLORS.muted }}
      >
        <CircleAlert className="h-4 w-4 flex-none" />
        <span className="min-w-0 flex-1 truncate">
          Counts from the grievance redress service, refreshed every 15 minutes. No grievance text, ticket or
          person is shown.
        </span>
        <ExportDataButton
          filePrefix="grievance-redress"
          captureTargetId="dashboard-grievance"
          csvSections={() => [
            { name: "Headline figures", rows: charts.grvKpis || [] },
            { name: "Performance this month", rows: charts.grvPerformanceKpis || [] },
            { name: "SLA risk", rows: charts.grvSlaRisk || [] },
            { name: "Status distribution", rows: charts.grvStatusDistribution || [] },
            { name: "Monthly trend", rows: charts.grvMonthlyTrend || [] },
            { name: "Net backlog", rows: charts.grvNetBacklogTrend || [] },
            { name: "Weekly trend", rows: charts.grvWeeklyTrend || [] },
            { name: "By service category", rows: charts.grvByCategory || [] },
            { name: "Resolution by category", rows: charts.grvCategoryResolution || [] },
            { name: "Resolution rate by region", rows: charts.grvResolutionRateByRegion || [] },
          ]}
        />
      </div>
    </div>
  )
}
