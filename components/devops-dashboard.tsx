"use client"

// DevOps view: the running state of the whole platform estate.
//
//   platform (4 registries + 4 services)
//     ├── app instances       -> on a worker node
//     ├── Postgres databases  -> primaries and replicas on a database node
//     ├── APIs                -> internal (platform-to-platform) and external (partner)
//     └── deployment pipelines
//   nodes (the hardware all of the above runs on)
//
// No monitoring feed is wired up yet, so everything here is backed by the mock
// data in data/devops/*.sql. These figures describe infrastructure rather than
// farmer geography, so the sidebar hides the registry filters while this
// dashboard is selected.

import { useMemo } from "react"
import {
  Activity,
  AlertTriangle,
  Boxes,
  CircleAlert,
  Copy,
  Cpu,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  Landmark,
  Layers,
  LifeBuoy,
  Network,
  PawPrint,
  Rocket,
  Server,
  ServerCog,
  ShieldAlert,
  Store,
  Timer,
  UserCog,
  Users,
  Wallet,
  Wheat,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useChartGroupData } from "@/hooks/use-data"
import {
  BRIGHT,
  BRIGHT_SERIES,
  BRIGHT_SOFT,
  CriticalCountChip,
  EmptyPanel,
  FaultAlert,
  FaultBadge,
  ProgressRow,
  REGISTRY_COLORS,
  RegistryCard,
  RegistryDonut,
  RegistryStat,
  SegmentRow,
  formatCompact,
  formatFull,
} from "@/components/registry/registry-ui"
import type { Severity } from "@/components/registry/registry-ui"
import { toNumber } from "@/components/registry/registry-data"
import { ExportDataButton } from "@/components/registry/export-button"

const CHART_NAMES = [
  "devopsKpis",
  "devopsPlatforms",
  "devopsInstanceStatus",
  "devopsNodes",
  "devopsClusters",
  "devopsDatabases",
  "devopsApiScope",
  "devopsApiHotspots",
  "devopsPipelines",
  "devopsPipelineTrend",
  "devopsDeployFrequency",
  "devopsTraffic",
  "devopsIncidents",
]

/** Each platform gets the glyph of the thing it actually serves. */
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  "farmer-registry": <Users className="h-3 w-3" />,
  "crop-registry": <Wheat className="h-3 w-3" />,
  "livestock-registry": <PawPrint className="h-3 w-3" />,
  "da-registry": <UserCog className="h-3 w-3" />,
  a2c: <Landmark className="h-3 w-3" />,
  a2m: <Store className="h-3 w-3" />,
  a2p: <Wallet className="h-3 w-3" />,
  a2g: <LifeBuoy className="h-3 w-3" />,
}

/** Hardware is read by what the host is there to do. */
const NODE_ROLE_ICONS: Record<string, React.ReactNode> = {
  "control-plane": <ServerCog className="h-3 w-3" />,
  worker: <Server className="h-3 w-3" />,
  database: <Database className="h-3 w-3" />,
  edge: <Network className="h-3 w-3" />,
}

const HEALTH_TONES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  HEALTHY: { bg: BRIGHT_SOFT.green, color: "#166534", dot: BRIGHT.green, label: "Healthy" },
  DEGRADED: { bg: BRIGHT_SOFT.amber, color: "#92400E", dot: BRIGHT.amber, label: "Degraded" },
  WARNING: { bg: BRIGHT_SOFT.amber, color: "#92400E", dot: BRIGHT.amber, label: "Warning" },
  LAGGING: { bg: BRIGHT_SOFT.amber, color: "#92400E", dot: BRIGHT.amber, label: "Lagging" },
  CRITICAL: { bg: BRIGHT.crimson, color: "#fff", dot: "#fff", label: "Critical" },
  DOWN: { bg: BRIGHT.crimson, color: "#fff", dot: "#fff", label: "Down" },
}

const PIPELINE_TONES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  SUCCESS: { bg: BRIGHT_SOFT.green, color: "#166534", dot: BRIGHT.green, label: "Passing" },
  RUNNING: { bg: BRIGHT_SOFT.blue, color: "#1D4ED8", dot: BRIGHT.blue, label: "Running" },
  FAILED: { bg: BRIGHT.crimson, color: "#fff", dot: "#fff", label: "Failed" },
}

const INSTANCE_STATUS_STYLES: Record<string, { color: string; label: string }> = {
  RUNNING: { color: BRIGHT.green, label: "Running" },
  DEGRADED: { color: BRIGHT.amber, label: "Degraded" },
  CRASHLOOP: { color: BRIGHT.crimson, label: "Crash loop" },
  STOPPED: { color: "#64748B", label: "Stopped" },
}

/** Incident severities carry their own vocabulary, so they name their own tone. */
const INCIDENT_SEVERITY: Record<string, { severity: Severity; label: string }> = {
  CRITICAL: { severity: "danger", label: "Critical" },
  MAJOR: { severity: "warning", label: "Major" },
  MINOR: { severity: "warning", label: "Minor" },
}

/** Saturation reads red once a host is close to running out of headroom. */
function saturationColor(percent: number): string {
  if (percent >= 95) return BRIGHT.crimson
  if (percent >= 85) return BRIGHT.amber
  if (percent >= 70) return BRIGHT.blueSoft
  return BRIGHT.green
}

/** Pipeline and instance durations read better as minutes once past a minute. */
function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/** Incident ages are measured from the newest sample, so hours and days suffice. */
function age(hours: number): string {
  if (hours < 1) return "just now"
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "16 Aug 08:12" — assembled rather than localised so it stays on one line. */
function timestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  const day = String(parsed.getDate()).padStart(2, "0")
  const hours = String(parsed.getHours()).padStart(2, "0")
  const minutes = String(parsed.getMinutes()).padStart(2, "0")
  return `${day} ${MONTHS[parsed.getMonth()]} ${hours}:${minutes}`
}

/** Health of a platform, database or node as a filled pill. */
function HealthPill({ status }: { status: string }) {
  const tone = HEALTH_TONES[status] || HEALTH_TONES.HEALTHY

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
      style={{ background: tone.bg, color: tone.color }}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  )
}

function PipelinePill({ status }: { status: string }) {
  const tone = PIPELINE_TONES[status] || PIPELINE_TONES.SUCCESS

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
      style={{ background: tone.bg, color: tone.color }}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  )
}

export function DevOpsDashboard() {
  // Infrastructure figures are estate-wide, so the group is fetched unfiltered.
  const { data, loading, error } = useChartGroupData(CHART_NAMES, {})
  const charts = data?.data || {}

  const kpis = charts.devopsKpis?.[0] || null
  const platformsTotal = toNumber(kpis?.platforms_total)
  const registries = toNumber(kpis?.registries)
  const services = toNumber(kpis?.services)
  const instancesTotal = toNumber(kpis?.instances_total)
  const instancesRunning = toNumber(kpis?.instances_running)
  const instancesUnhealthy = toNumber(kpis?.instances_unhealthy)
  const restarts24h = toNumber(kpis?.restarts_24h)
  const databasesTotal = toNumber(kpis?.databases_total)
  const databasesHealthy = toNumber(kpis?.databases_healthy)
  const databasesReplicas = toNumber(kpis?.databases_replicas)
  const databaseSizeGb = toNumber(kpis?.database_size_gb)
  const maxReplicationLag = toNumber(kpis?.max_replication_lag_s)
  const apisInternal = toNumber(kpis?.apis_internal)
  const apisExternal = toNumber(kpis?.apis_external)
  const apisDegraded = toNumber(kpis?.apis_degraded)
  const internalAvailability = toNumber(kpis?.internal_availability_pct)
  const externalAvailability = toNumber(kpis?.external_availability_pct)
  const requests24h = toNumber(kpis?.requests_24h)
  const errorRate = toNumber(kpis?.error_rate_pct)
  const nodesTotal = toNumber(kpis?.nodes_total)
  const nodesHealthy = toNumber(kpis?.nodes_healthy)
  const nodesWarning = toNumber(kpis?.nodes_warning)
  const nodesCritical = toNumber(kpis?.nodes_critical)
  const cpuCores = toNumber(kpis?.cpu_cores)
  const memoryGb = toNumber(kpis?.memory_gb)
  const diskTb = toNumber(kpis?.disk_tb)
  const avgCpu = toNumber(kpis?.avg_cpu_pct)
  const avgMemory = toNumber(kpis?.avg_memory_pct)
  const avgDisk = toNumber(kpis?.avg_disk_pct)
  const pipelinesTotal = toNumber(kpis?.pipelines_total)
  const pipelinesFailed = toNumber(kpis?.pipelines_failed)
  const pipelinesRunning = toNumber(kpis?.pipelines_running)
  const deploys30d = toNumber(kpis?.deploys_30d)
  const deploySuccessRate = toNumber(kpis?.deploy_success_rate_pct)
  const incidentsOpen = toNumber(kpis?.incidents_open)
  const incidentsCritical = toNumber(kpis?.incidents_critical)

  const platforms = useMemo(
    () =>
      (charts.devopsPlatforms || []).map((row: any) => ({
        key: String(row.platform_key),
        name: String(row.name),
        shortName: String(row.short_name),
        kind: String(row.kind),
        tier: String(row.tier),
        ownerTeam: String(row.owner_team),
        version: String(row.version),
        instances: toNumber(row.instances),
        instancesRunning: toNumber(row.instances_running),
        databases: toNumber(row.databases),
        databasesUnhealthy: toNumber(row.databases_unhealthy),
        apisInternal: toNumber(row.apis_internal),
        apisExternal: toNumber(row.apis_external),
        apisDegraded: toNumber(row.apis_degraded),
        availability: toNumber(row.availability_pct),
        requests: toNumber(row.requests_24h),
        openIncidents: toNumber(row.open_incidents),
        pipelinesFailed: toNumber(row.pipelines_failed),
        status: String(row.status),
      })),
    [charts.devopsPlatforms]
  )

  const instanceSegments = useMemo(
    () =>
      (charts.devopsInstanceStatus || []).map((row: any) => {
        const status = String(row.status)
        const style = INSTANCE_STATUS_STYLES[status] || { color: BRIGHT.blue, label: status }
        return {
          name: style.label,
          value: toNumber(row.instances),
          color: style.color,
        }
      }),
    [charts.devopsInstanceStatus]
  )

  const nodes = useMemo(
    () =>
      (charts.devopsNodes || []).map((row: any) => ({
        hostname: String(row.hostname),
        role: String(row.role),
        cluster: String(row.cluster),
        datacentre: String(row.datacentre),
        cpuCores: toNumber(row.cpu_cores),
        memoryGb: toNumber(row.memory_gb),
        cpuPct: toNumber(row.cpu_pct),
        memoryPct: toNumber(row.memory_pct),
        diskPct: toNumber(row.disk_pct),
        peakPct: toNumber(row.peak_pct),
        status: String(row.status),
        instances: toNumber(row.instances),
        databases: toNumber(row.databases),
      })),
    [charts.devopsNodes]
  )

  const clusters = useMemo(
    () =>
      (charts.devopsClusters || []).map((row: any) => ({
        cluster: String(row.cluster),
        datacentre: String(row.datacentre),
        nodes: toNumber(row.nodes),
      })),
    [charts.devopsClusters]
  )

  const databases = useMemo(
    () =>
      (charts.devopsDatabases || []).map((row: any) => ({
        dbName: String(row.db_name),
        role: String(row.role),
        platform: String(row.platform),
        node: String(row.node),
        sizeGb: toNumber(row.size_gb),
        connections: toNumber(row.connections),
        connectionPct: toNumber(row.connection_pct),
        replicationLag: toNumber(row.replication_lag_s),
        status: String(row.status),
      })),
    [charts.devopsDatabases]
  )

  const apiScope = useMemo(() => {
    const rows = charts.devopsApiScope || []
    const find = (scope: string) => rows.find((row: any) => String(row.scope) === scope)
    const shape = (row: any) =>
      row
        ? {
            endpoints: toNumber(row.endpoints),
            requests: toNumber(row.requests_24h),
            errorRate: toNumber(row.error_rate_pct),
            availability: toNumber(row.availability_pct),
            p95: toNumber(row.p95_latency_ms),
            degraded: toNumber(row.degraded),
          }
        : null
    return { internal: shape(find("INTERNAL")), external: shape(find("EXTERNAL")) }
  }, [charts.devopsApiScope])

  const apiHotspots = useMemo(
    () =>
      (charts.devopsApiHotspots || []).map((row: any) => ({
        name: String(row.name),
        scope: String(row.scope),
        platform: String(row.platform),
        consumer: String(row.consumer),
        errorRate: toNumber(row.error_rate_pct),
        p95: toNumber(row.p95_latency_ms),
        availability: toNumber(row.availability_pct),
        failedCalls: toNumber(row.failed_calls_24h),
        status: String(row.status),
      })),
    [charts.devopsApiHotspots]
  )

  const pipelines = useMemo(
    () =>
      (charts.devopsPipelines || []).map((row: any) => ({
        name: String(row.name),
        platform: String(row.platform),
        platformShort: String(row.platform_short),
        environment: String(row.environment),
        lastStatus: String(row.last_status),
        lastDuration: toNumber(row.last_duration_s),
        lastRunAt: row.last_run_at as string,
        failedStage: row.failed_stage ? String(row.failed_stage) : null,
        deploys30d: toNumber(row.deploys_30d),
        successRate: toNumber(row.success_rate_pct),
      })),
    [charts.devopsPipelines]
  )

  const pipelineTrend = useMemo(
    () =>
      (charts.devopsPipelineTrend || []).map((row: any) => ({
        label: String(row.label),
        runs: toNumber(row.runs),
        succeeded: toNumber(row.succeeded),
        failed: toNumber(row.failed),
      })),
    [charts.devopsPipelineTrend]
  )

  const deployFrequency = useMemo(
    () =>
      (charts.devopsDeployFrequency || []).map((row: any) => ({
        platform: String(row.platform),
        kind: String(row.kind),
        deploys: toNumber(row.deploys_30d),
        successRate: toNumber(row.success_rate_pct),
        leadTime: toNumber(row.lead_time_hours),
      })),
    [charts.devopsDeployFrequency]
  )

  const traffic = useMemo(
    () =>
      (charts.devopsTraffic || []).map((row: any) => ({
        label: String(row.label),
        requests: toNumber(row.requests),
        errors: toNumber(row.errors),
        errorRate: toNumber(row.error_rate_pct),
        p95: toNumber(row.p95_latency_ms),
      })),
    [charts.devopsTraffic]
  )

  // Severity order comes from the query, so the worst incident always leads.
  const incidents = useMemo(
    () =>
      (charts.devopsIncidents || []).map((row: any) => ({
        title: String(row.title),
        component: String(row.component),
        severity: String(row.severity),
        status: String(row.status),
        platform: String(row.platform),
        ageHours: toNumber(row.age_hours),
      })),
    [charts.devopsIncidents]
  )

  const nodePeakMax = nodes.reduce((acc: number, row: { peakPct: number }) => Math.max(acc, row.peakPct), 0)
  const deployMax = deployFrequency.reduce((acc: number, row: { deploys: number }) => Math.max(acc, row.deploys), 0)
  const hotspotMax = apiHotspots.reduce((acc: number, row: { errorRate: number }) => Math.max(acc, row.errorRate), 0)
  const clusterNote = clusters.map((row: { cluster: string; nodes: number }) => `${row.cluster} ${row.nodes}`).join(" · ")

  const share = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)

  if (error) {
    return (
      <RegistryCard title="DevOps — Infrastructure Monitoring">
        <div className="px-4 pb-5 pt-3 text-[12px]" style={{ color: REGISTRY_COLORS.red }}>
          Failed to load DevOps data: {error}
        </div>
      </RegistryCard>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 @[860px]:grid @[860px]:grid-rows-[auto_minmax(0,190fr)_minmax(0,188fr)_minmax(0,112fr)_auto]">
      {/* Band 1 — the estate at a glance */}
      <section className="grid flex-none grid-cols-2 gap-3 @[640px]:grid-cols-4 @[1180px]:grid-cols-8">
        <RegistryStat
          icon={<Layers className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          tint="blue"
          value={formatFull(platformsTotal)}
          label="Platforms Monitored"
          note={`${formatFull(registries)} registries · ${formatFull(services)} services`}
          loading={loading}
        />
        <RegistryStat
          icon={<Boxes className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.tealSoft}
          tint={instancesUnhealthy > 0 ? "amber" : "teal"}
          value={`${formatFull(instancesRunning)}/${formatFull(instancesTotal)}`}
          valueColor={instancesUnhealthy > 0 ? BRIGHT.amber : undefined}
          label="App Instances Up"
          note={`${formatFull(instancesUnhealthy)} off nominal · ${formatFull(restarts24h)} restarts`}
          loading={loading}
        />
        <RegistryStat
          icon={<Database className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          tint="violet"
          value={`${formatFull(databasesHealthy)}/${formatFull(databasesTotal)}`}
          label="Postgres Healthy"
          note={`${formatCompact(databaseSizeGb)} GB · ${formatFull(databasesReplicas)} replicas`}
          loading={loading}
        />
        <RegistryStat
          icon={<Network className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.sky}
          iconColor={BRIGHT.sky}
          tint="teal"
          value={formatFull(apisInternal)}
          label="Internal APIs"
          note={`${internalAvailability.toFixed(2)}% available`}
          loading={loading}
        />
        <RegistryStat
          icon={<Globe className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          tint="green"
          value={formatFull(apisExternal)}
          label="External APIs"
          note={`${externalAvailability.toFixed(2)}% available`}
          loading={loading}
        />
        <RegistryStat
          icon={<Cpu className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.orange}
          iconColor={BRIGHT.orange}
          tint="peach"
          value={formatFull(nodesTotal)}
          label="Hardware Nodes"
          note={`${formatFull(cpuCores)} cores · ${formatCompact(memoryGb)} GB RAM`}
          loading={loading}
        />
        <RegistryStat
          icon={<Rocket className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          tint="amber"
          value={`${deploySuccessRate.toFixed(1)}%`}
          label="Deploy Success"
          note={`${formatFull(deploys30d)} deploys in 30 days`}
          loading={loading}
        />
        <RegistryStat
          icon={<AlertTriangle className="h-7 w-7" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          tint={incidentsOpen > 0 ? "red" : "green"}
          value={formatFull(incidentsOpen)}
          valueColor={incidentsOpen > 0 ? BRIGHT.crimson : undefined}
          label="Open Incidents"
          note={`${formatFull(incidentsCritical)} critical · ${formatFull(pipelinesFailed)} pipeline red`}
          loading={loading}
        />
      </section>

      {/* Band 2 — every platform, the traffic it serves, and what is off nominal */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[3.5fr_2.6fr_1.8fr_2.1fr]">
        <RegistryCard
          dense
          icon={<Layers className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="Registry Instances & Services"
          subtitle={`${formatFull(registries)} registries and ${formatFull(services)} services · instances, databases and APIs per platform`}
          className="flex min-h-[260px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-1"
        >
          {platforms.length === 0 ? (
            <EmptyPanel message="No platforms registered" />
          ) : (
            <div>
              <div
                className="grid grid-cols-[minmax(0,1.6fr)_44px_32px_52px_50px_44px_auto] gap-2 border-b pb-1 text-[9.5px]"
                style={{ borderColor: REGISTRY_COLORS.line2, color: REGISTRY_COLORS.muted }}
              >
                <span>Platform</span>
                <span className="text-right">Inst.</span>
                <span className="text-right">DB</span>
                <span className="text-right">APIs</span>
                <span className="text-right">Avail.</span>
                <span className="text-right">Alerts</span>
                <span className="text-right">Health</span>
              </div>
              {platforms.map((row: any) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[minmax(0,1.6fr)_44px_32px_52px_50px_44px_auto] items-center gap-2 py-[3px] text-[10.5px]"
                  style={{ color: REGISTRY_COLORS.ink2 }}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="grid h-4 w-4 flex-none place-items-center self-center rounded-[5px]"
                      style={{
                        background: row.kind === "REGISTRY" ? BRIGHT_SOFT.blue : BRIGHT_SOFT.teal,
                        color: row.kind === "REGISTRY" ? BRIGHT.blue : BRIGHT.teal,
                      }}
                    >
                      {PLATFORM_ICONS[row.key] || <Server className="h-3 w-3" />}
                    </span>
                    <span
                      className="flex-none font-semibold"
                      style={{ color: REGISTRY_COLORS.ink }}
                      title={`${row.name} · ${row.version} · ${row.ownerTeam} · ${row.tier} tier`}
                    >
                      {row.shortName}
                    </span>
                    <span className="truncate text-[9px]" style={{ color: REGISTRY_COLORS.muted }}>
                      {row.kind === "REGISTRY" ? "Registry" : "Service"} · {row.tier}
                    </span>
                  </span>
                  <span
                    className="text-right font-semibold"
                    style={{ color: row.instancesRunning < row.instances ? BRIGHT.crimson : REGISTRY_COLORS.ink }}
                  >
                    {row.instancesRunning}/{row.instances}
                  </span>
                  <span
                    className="text-right"
                    style={{ color: row.databasesUnhealthy > 0 ? BRIGHT.crimson : REGISTRY_COLORS.ink2 }}
                    title={`${row.databases} Postgres database${row.databases === 1 ? "" : "s"}`}
                  >
                    {row.databases}
                  </span>
                  <span
                    className="text-right"
                    style={{ color: row.apisDegraded > 0 ? BRIGHT.crimson : REGISTRY_COLORS.ink2 }}
                    title={`${row.apisInternal} internal · ${row.apisExternal} external`}
                  >
                    {row.apisInternal}
                    <span style={{ color: REGISTRY_COLORS.muted }}>+{row.apisExternal}</span>
                  </span>
                  <span className="text-right font-semibold" style={{ color: REGISTRY_COLORS.ink }}>
                    {row.availability.toFixed(2)}
                  </span>
                  <span className="text-right">
                    <FaultBadge count={row.openIncidents} />
                  </span>
                  <span className="text-right">
                    <HealthPill status={row.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Activity className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.sky}
          iconColor={BRIGHT.sky}
          title="API Traffic & Errors"
          subtitle={`${formatCompact(requests24h)} calls in 24h · ${errorRate.toFixed(2)}% weighted error rate`}
          className="flex min-h-[220px] flex-col @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {traffic.length === 0 ? (
            <EmptyPanel message="No traffic samples" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={traffic} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="devops-requests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.blueSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.blueSoft} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={22}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  yAxisId="requests"
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <YAxis
                  yAxisId="errorRate"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={26}
                  tick={{ fontSize: 9.5, fill: BRIGHT.crimson }}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${REGISTRY_COLORS.line}`, fontSize: 11 }}
                  formatter={(value: any, name: any) =>
                    name === "errorRate"
                      ? [`${toNumber(value).toFixed(2)}%`, "Error rate"]
                      : [formatFull(toNumber(value)), "Requests"]
                  }
                />
                <Area
                  yAxisId="requests"
                  type="monotone"
                  dataKey="requests"
                  stroke={BRIGHT.blue}
                  strokeWidth={2}
                  fill="url(#devops-requests)"
                  dot={false}
                  activeDot={{ r: 3.5, fill: BRIGHT.blue, stroke: "#fff", strokeWidth: 1.6 }}
                />
                <Line
                  yAxisId="errorRate"
                  type="monotone"
                  dataKey="errorRate"
                  stroke={BRIGHT.crimson}
                  strokeWidth={1.8}
                  strokeDasharray="3 2"
                  dot={false}
                  activeDot={{ r: 3, fill: BRIGHT.crimson, stroke: "#fff", strokeWidth: 1.4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Boxes className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.tealSoft}
          title="Instance Health"
          subtitle={`${formatFull(instancesTotal)} instances across ${formatFull(platformsTotal)} platforms`}
          className="flex min-h-[220px] flex-col @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 items-center"
        >
          <RegistryDonut
            subInline
            ringSize={104}
            className="w-full"
            segments={instanceSegments}
            centerValue={formatFull(instancesRunning)}
            centerLabel="Running"
            totalLabel="Restarts"
            totalValue={`${formatFull(restarts24h)} in 24h`}
          />
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Globe className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          title="API Surface"
          subtitle="Internal exchange versus partner-facing"
          className="flex min-h-0 flex-col"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[10px] px-3 pb-2.5 pt-2"
        >
          <SegmentRow
            icon={<Network className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.sky}
            iconColor={BRIGHT.sky}
            label={`Internal · ${formatFull(apiScope.internal?.endpoints || 0)} endpoints`}
            value={`${(apiScope.internal?.availability || 0).toFixed(2)}%`}
            share={`(${formatCompact(apiScope.internal?.requests || 0)} calls · ${formatFull(apiScope.internal?.p95 || 0)}ms)`}
          />
          <SegmentRow
            icon={<Globe className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.green}
            iconColor={BRIGHT.green}
            label={`External · ${formatFull(apiScope.external?.endpoints || 0)} endpoints`}
            value={`${(apiScope.external?.availability || 0).toFixed(2)}%`}
            share={`(${formatCompact(apiScope.external?.requests || 0)} calls · ${formatFull(apiScope.external?.p95 || 0)}ms)`}
          />
          <SegmentRow
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.red}
            iconColor={BRIGHT.crimson}
            label="Endpoints off nominal"
            value={formatFull(apisDegraded)}
            share={`(of ${formatFull(apisInternal + apisExternal)} monitored)`}
          />
          <SegmentRow
            icon={<Timer className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.violet}
            iconColor={BRIGHT.violet}
            label="Replication lag, worst replica"
            value={`${formatFull(maxReplicationLag)}s`}
            share={`(${formatFull(databasesReplicas)} replicas)`}
          />
        </RegistryCard>
      </section>

      {/* Band 3 — pipelines, live incidents, deploy momentum */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[3.5fr_2.6fr_2.1fr]">
        <RegistryCard
          dense
          icon={<GitBranch className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          title="Deployment Pipelines"
          subtitle={`${formatFull(pipelinesTotal)} pipelines · ${formatFull(pipelinesRunning)} running · ${deploySuccessRate.toFixed(1)}% of runs pass`}
          actions={<CriticalCountChip count={pipelinesFailed} noun="failing" />}
          className="flex min-h-[240px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-1"
        >
          {pipelines.length === 0 ? (
            <EmptyPanel message="No pipelines configured" />
          ) : (
            <div>
              <div
                className="grid grid-cols-[minmax(0,1.7fr)_38px_72px_44px_auto] gap-2 border-b pb-1 text-[9.5px]"
                style={{ borderColor: REGISTRY_COLORS.line2, color: REGISTRY_COLORS.muted }}
              >
                <span>Pipeline</span>
                <span className="text-right">Pass</span>
                <span className="text-right">Last run</span>
                <span className="text-right">Time</span>
                <span className="text-right">State</span>
              </div>
              {pipelines.map((row: any) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[minmax(0,1.7fr)_38px_72px_44px_auto] items-center gap-2 py-[2px] text-[10.5px]"
                  style={{ color: REGISTRY_COLORS.ink2 }}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="grid h-4 w-4 flex-none place-items-center self-center rounded-[5px]"
                      style={{
                        background: row.lastStatus === "FAILED" ? BRIGHT_SOFT.red : BRIGHT_SOFT.violet,
                        color: row.lastStatus === "FAILED" ? BRIGHT.crimson : BRIGHT.violet,
                      }}
                    >
                      <GitBranch className="h-3 w-3" />
                    </span>
                    <span
                      className="truncate font-semibold"
                      style={{ color: REGISTRY_COLORS.ink }}
                      title={`${row.name} · ${row.platform} · ${row.environment}${row.failedStage ? ` · failed at ${row.failedStage}` : ""}`}
                    >
                      {row.name}
                    </span>
                    <span className="truncate text-[9px]" style={{ color: REGISTRY_COLORS.muted }}>
                      {row.failedStage || row.platformShort}
                    </span>
                  </span>
                  <span
                    className="text-right font-semibold"
                    style={{ color: row.successRate < 80 ? BRIGHT.crimson : REGISTRY_COLORS.ink }}
                  >
                    {row.successRate.toFixed(0)}%
                  </span>
                  <span className="whitespace-nowrap text-right text-[9.5px]">{timestamp(row.lastRunAt)}</span>
                  <span className="text-right">{duration(row.lastDuration)}</span>
                  <span className="text-right">
                    <PipelinePill status={row.lastStatus} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<AlertTriangle className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          title="Active Incidents"
          subtitle={`${formatFull(incidentsOpen)} open across nodes, databases, APIs and pipelines`}
          actions={<CriticalCountChip count={incidentsCritical} noun="critical" />}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[5px] px-2.5 pb-2 pt-1.5"
        >
          {incidents.length === 0 ? (
            <EmptyPanel message="Nothing alerting across the estate" />
          ) : (
            incidents.map((row: any) => {
              const tone = INCIDENT_SEVERITY[row.severity] || INCIDENT_SEVERITY.MINOR
              return (
                <FaultAlert
                  key={`${row.component}-${row.title}`}
                  severity={row.status === "MITIGATED" ? "info" : tone.severity}
                  label={row.status === "MITIGATED" ? "Mitigated" : tone.label}
                  title={row.title}
                  context={`${row.component} · ${row.platform}`}
                  value={age(row.ageHours)}
                />
              )
            })
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Rocket className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          title="Deploy Activity"
          subtitle="Pipeline runs per day, last 14 days"
          className="flex min-h-[200px] flex-col @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {pipelineTrend.length === 0 ? (
            <EmptyPanel message="No pipeline history" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pipelineTrend} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="devops-succeeded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.greenSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.greenSoft} stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="devops-failed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.crimson} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={BRIGHT.crimson} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={18}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={22}
                  allowDecimals={false}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${REGISTRY_COLORS.line}`, fontSize: 11 }}
                  formatter={(value: any, name: any) => [
                    formatFull(toNumber(value)),
                    name === "succeeded" ? "Succeeded" : "Failed",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="succeeded"
                  stroke={BRIGHT.green}
                  strokeWidth={2}
                  fill="url(#devops-succeeded)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.green, strokeWidth: 1.4 }}
                  activeDot={{ r: 3.5, fill: BRIGHT.green, stroke: "#fff", strokeWidth: 1.6 }}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke={BRIGHT.crimson}
                  strokeWidth={2}
                  fill="url(#devops-failed)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.crimson, strokeWidth: 1.4 }}
                  activeDot={{ r: 3.5, fill: BRIGHT.crimson, stroke: "#fff", strokeWidth: 1.6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>
      </section>

      {/* Band 4 — hardware, databases, the endpoints to look at first, deploy cadence */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[2.5fr_2.4fr_2.5fr_2.1fr]">
        <RegistryCard
          dense
          icon={<HardDrive className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.orange}
          iconColor={BRIGHT.orange}
          title="Hardware Saturation"
          subtitle={`${formatFull(nodesTotal)} nodes · ${clusterNote || "no clusters"} · ${diskTb.toFixed(1)} TB disk`}
          actions={<CriticalCountChip count={nodesCritical} noun="critical" />}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {nodes.length === 0 ? (
            <EmptyPanel message="No nodes reporting" />
          ) : (
            <>
              {nodes.slice(0, 7).map((row: any) => (
                <ProgressRow
                  key={row.hostname}
                  icon={NODE_ROLE_ICONS[row.role] || <Server className="h-3 w-3" />}
                  iconColor={saturationColor(row.peakPct)}
                  label={`${row.hostname} · ${row.role}`}
                  value={`${row.peakPct.toFixed(0)}%`}
                  percent={share(row.peakPct, Math.max(nodePeakMax, 100))}
                  color={saturationColor(row.peakPct)}
                  barWidth="44px"
                />
              ))}
              {nodes.length > 7 && (
                <span className="px-1 text-[9.5px]" style={{ color: REGISTRY_COLORS.muted }}>
                  +{nodes.length - 7} further nodes · {formatFull(nodesHealthy)} healthy,{" "}
                  {formatFull(nodesWarning)} warning · avg {avgCpu.toFixed(0)}% CPU, {avgMemory.toFixed(0)}% memory,{" "}
                  {avgDisk.toFixed(0)}% disk
                </span>
              )}
            </>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Database className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          title="Postgres Connection Load"
          subtitle={`${formatFull(databasesTotal)} databases · ${formatFull(databasesTotal - databasesHealthy)} off nominal`}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {databases.length === 0 ? (
            <EmptyPanel message="No databases reporting" />
          ) : (
            <>
              {databases.slice(0, 7).map((row: any) => (
                <ProgressRow
                  key={row.dbName}
                  icon={row.role === "REPLICA" ? <Copy className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                  iconColor={row.status === "HEALTHY" ? saturationColor(row.connectionPct) : BRIGHT.crimson}
                  label={
                    row.replicationLag > 30
                      ? `${row.dbName} · ${formatFull(row.replicationLag)}s lag`
                      : `${row.dbName} · ${row.node}`
                  }
                  value={`${row.connectionPct.toFixed(0)}%`}
                  percent={share(row.connectionPct, 100)}
                  color={row.status === "HEALTHY" ? saturationColor(row.connectionPct) : BRIGHT.crimson}
                  barWidth="44px"
                />
              ))}
              {databases.length > 7 && (
                <span className="px-1 text-[9.5px]" style={{ color: REGISTRY_COLORS.muted }}>
                  +{databases.length - 7} further databases · {formatCompact(databaseSizeGb)} GB across primaries
                </span>
              )}
            </>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<ShieldAlert className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          title="API Hotspots"
          subtitle="Highest error rate first, internal and external"
          actions={<CriticalCountChip count={apisDegraded} noun="degraded" />}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {apiHotspots.length === 0 ? (
            <EmptyPanel message="No endpoints reporting" />
          ) : (
            apiHotspots.slice(0, 7).map((row: any) => (
              <ProgressRow
                key={`${row.platform}-${row.name}`}
                icon={row.scope === "EXTERNAL" ? <Globe className="h-3 w-3" /> : <Network className="h-3 w-3" />}
                iconColor={row.status === "HEALTHY" ? BRIGHT.green : BRIGHT.crimson}
                label={`${row.name} · ${row.platform}`}
                value={`${row.errorRate.toFixed(2)}%`}
                percent={share(row.errorRate, hotspotMax)}
                color={row.status === "HEALTHY" ? BRIGHT.blueSoft : BRIGHT.crimson}
                barWidth="40px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<GitBranch className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          title="Deploy Cadence"
          subtitle={`${formatFull(deploys30d)} deploys in 30 days`}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {deployFrequency.length === 0 ? (
            <EmptyPanel message="No deploy history" />
          ) : (
            deployFrequency.slice(0, 8).map((row: any, index: number) => (
              <ProgressRow
                key={row.platform}
                icon={<Rocket className="h-3 w-3" />}
                iconColor={row.successRate < 80 ? BRIGHT.crimson : BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                label={`${row.platform} · ${row.successRate.toFixed(0)}% pass`}
                value={formatFull(row.deploys)}
                percent={share(row.deploys, deployMax)}
                color={row.successRate < 80 ? BRIGHT.crimson : BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                barWidth="40px"
              />
            ))
          )}
        </RegistryCard>
      </section>

      {/* Source ribbon */}
      <div
        className="flex flex-none items-center gap-2 rounded-xl border px-4 py-1 text-[11px]"
        style={{ borderColor: "#FBD9D9", background: "#FEF6F6", color: "#7F1D1D" }}
      >
        <CircleAlert className="h-4 w-4 flex-none" />
        <strong className="font-semibold">Mock data:</strong>
        <span className="min-w-0 flex-1 truncate">
          No monitoring feed is connected yet. Figures come from data/devops/*.sql — {formatFull(platformsTotal)}{" "}
          platforms on {formatFull(nodesTotal)} nodes — and are not affected by the registry filters.
          {incidentsOpen > 0 ? ` ${formatFull(incidentsOpen)} incidents currently open.` : ""}
        </span>
        <ExportDataButton
          filePrefix="devops-infrastructure"
          captureTargetId="dashboard-devops"
          csvSections={() => [
            { name: "Platforms", rows: charts.devopsPlatforms || [] },
            { name: "Hardware nodes", rows: charts.devopsNodes || [] },
            { name: "Clusters", rows: charts.devopsClusters || [] },
            { name: "App instances by status", rows: charts.devopsInstanceStatus || [] },
            { name: "Databases", rows: charts.devopsDatabases || [] },
            { name: "API scope", rows: charts.devopsApiScope || [] },
            { name: "API hotspots", rows: charts.devopsApiHotspots || [] },
            { name: "Deployment pipelines", rows: charts.devopsPipelines || [] },
            { name: "Deploy cadence", rows: charts.devopsDeployFrequency || [] },
            { name: "Pipeline runs per day", rows: charts.devopsPipelineTrend || [] },
            { name: "Traffic samples", rows: charts.devopsTraffic || [] },
            { name: "Incidents", rows: charts.devopsIncidents || [] },
          ]}
        />
      </div>
    </div>
  )
}
