"use client"

// A2C (Access to Credit) view: the consent-driven pipeline that lets Ethiopian
// credit providers use farmer registry data to underwrite a loan.
//
//   consent request -> approved consent -> registry data share -> loan decision
//
// There is no live A2C feed yet, so everything here is backed by the sample data
// in data/a2c/*.sql. A2C carries its own location P-codes rather than g2p ids,
// so the sidebar hides the registry filters while this dashboard is selected.

import { useMemo } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Building2,
  CircleAlert,
  ClipboardList,
  Droplets,
  FileCheck2,
  FileClock,
  Files,
  Hourglass,
  Landmark,
  LandPlot,
  Map,
  MapPin,
  Package,
  PawPrint,
  PieChart,
  PiggyBank,
  Scale,
  ShieldCheck,
  ShieldX,
  Sprout,
  ThumbsDown,
  Tractor,
  TrendingUp,
  UserRound,
  Wallet,
  Wheat,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useChartGroupData } from "@/hooks/use-data"
import type { A2CFilters } from "@/hooks/use-a2c-filters"
import { MapWhenVisible } from "@/components/lazy/map-when-visible"
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
import { toNumber } from "@/components/registry/registry-data"
import { ExportDataButton } from "@/components/registry/export-button"

const CHART_NAMES = [
  "a2cKpis",
  "a2cProviders",
  "a2cLoansByRegion",
  "a2cLocationSummary",
  "a2cApplicationStatus",
  "a2cConsentStatus",
  "a2cLoanProducts",
  "a2cLoanTrend",
  "a2cDataShares",
  "a2cDataShareFaults",
  "a2cDeclineReasons",
]

// Module scope keeps the reference stable so the map's drill-down effect doesn't loop.
const A2C_CHILD_CHARTS = {
  zones: "a2cLoansByZone",
  woredas: "a2cLoansByWoreda",
  kebeles: "a2cLoansByKebele",
}

const CONSENT_COLORS: Record<string, string> = {
  APPROVED: BRIGHT.green,
  PENDING: BRIGHT.amber,
  DECLINED: BRIGHT.crimson,
}

const APPLICATION_COLORS: Record<string, string> = {
  APPROVED: BRIGHT.green,
  IN_PROGRESS: BRIGHT.blue,
  PENDING: BRIGHT.amber,
  DECLINED: BRIGHT.crimson,
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  PENDING: "Pending",
  DECLINED: "Declined",
}

/** Lenders are told apart by what kind of institution they are. */
const PROVIDER_TYPE_ICONS: Record<string, React.ReactNode> = {
  "Commercial bank": <Landmark className="h-3 w-3" />,
  Microfinance: <PiggyBank className="h-3 w-3" />,
  "Development bank": <Building2 className="h-3 w-3" />,
}

/** Each product funds a different part of the farm. */
const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  "Input Loan": <Sprout className="h-3 w-3" />,
  "Working Capital": <Wallet className="h-3 w-3" />,
  "Farm Equipment": <Tractor className="h-3 w-3" />,
  "Livestock Loan": <PawPrint className="h-3 w-3" />,
  "Irrigation Loan": <Droplets className="h-3 w-3" />,
}

/** Registry datasets, glyphed by the part of the farmer profile they carry. */
const DATASET_ICONS: Record<string, React.ReactNode> = {
  "Farmer Profile": <UserRound className="h-3 w-3" />,
  "Land Holding": <LandPlot className="h-3 w-3" />,
  "Crop History": <Wheat className="h-3 w-3" />,
  "Livestock Holding": <PawPrint className="h-3 w-3" />,
  "Input Usage": <Package className="h-3 w-3" />,
}

/** Decline reasons, glyphed by what failed the assessment. */
const DECLINE_ICONS: Record<string, React.ReactNode> = {
  "Land holding below product minimum": <LandPlot className="h-3 w-3" />,
  "Existing arrears with another lender": <Scale className="h-3 w-3" />,
  "Registry profile incomplete": <ClipboardList className="h-3 w-3" />,
  "Requested amount above unsecured ceiling": <Banknote className="h-3 w-3" />,
  "Yield history insufficient for term": <Hourglass className="h-3 w-3" />,
}

/** ETB amounts read better abbreviated; the currency is fixed programme-wide. */
const etb = (value: number) => `ETB ${formatCompact(value)}`

/** Onboarding state of a provider: only ACTIVE lenders can receive registry data. */
function ProviderPill({ status }: { status: string }) {
  const style =
    status === "ACTIVE"
      ? { background: BRIGHT_SOFT.green, color: "#166534", dot: BRIGHT.green, label: "Live" }
      : status === "ONBOARDING"
        ? { background: BRIGHT_SOFT.amber, color: "#92400E", dot: BRIGHT.amber, label: "Onboarding" }
        : { background: BRIGHT.crimson, color: "#fff", dot: "#fff", label: "Suspended" }

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
      style={{ background: style.background, color: style.color }}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: style.dot }} />
      {style.label}
    </span>
  )
}

export function A2CDashboard({
  filters,
  geoJsonData,
  onMapFilterChange,
}: {
  filters: A2CFilters
  geoJsonData?: { regions: any; zones: any; woredas: any }
  onMapFilterChange: (filters: { region?: string; zone?: string; woreda?: string }) => void
}) {
  // Every panel below is scoped by the same lender and location selection.
  const { data, loading, error } = useChartGroupData(CHART_NAMES, filters)
  const charts = data?.data || {}

  const kpis = charts.a2cKpis?.[0] || null
  const providersOnboarded = toNumber(kpis?.providers_onboarded)
  const providersOnboarding = toNumber(kpis?.providers_onboarding)
  const providersTotal = toNumber(kpis?.providers_total)
  const consentRequests = toNumber(kpis?.consent_requests)
  const consentsApproved = toNumber(kpis?.consents_approved)
  const consentsPending = toNumber(kpis?.consents_pending)
  const consentsDeclined = toNumber(kpis?.consents_declined)
  const applicationsTotal = toNumber(kpis?.applications_total)
  const applicationsInProgress = toNumber(kpis?.applications_in_progress)
  const loansApproved = toNumber(kpis?.loans_approved)
  const loansDeclined = toNumber(kpis?.loans_declined)
  const loansPending = toNumber(kpis?.loans_pending)
  const dataSharesDelivered = toNumber(kpis?.data_shares_delivered)
  const dataSharesTotal = toNumber(kpis?.data_shares_total)
  const dataSharesFailed = toNumber(kpis?.data_shares_failed)
  const recordsShared = toNumber(kpis?.records_shared)
  const loanValueApproved = toNumber(kpis?.loan_value_approved)
  const loanValueRequested = toNumber(kpis?.loan_value_requested)
  const farmersEnrolled = toNumber(kpis?.farmers_enrolled)

  const openDecisions = loansDeclined + loansPending
  const consentApprovalRate = consentRequests > 0 ? (consentsApproved / consentRequests) * 100 : 0
  const loanApprovalRate = applicationsTotal > 0 ? (loansApproved / applicationsTotal) * 100 : 0
  const averageLoan = loansApproved > 0 ? loanValueApproved / loansApproved : 0

  const providers = useMemo(
    () =>
      (charts.a2cProviders || []).map((row: any) => ({
        shortName: String(row.short_name),
        name: String(row.name),
        providerType: String(row.provider_type),
        status: String(row.status),
        integration: String(row.integration),
        consentRequests: toNumber(row.consent_requests),
        applications: toNumber(row.applications),
        loansApproved: toNumber(row.loans_approved),
        loanValue: toNumber(row.loan_value),
        faults: toNumber(row.share_faults),
      })),
    [charts.a2cProviders]
  )

  // The map keys its metric off a column literally named "farmers"; here it
  // carries approved loan value in ETB.
  const loansByRegion = useMemo(
    () =>
      (charts.a2cLoansByRegion || []).map((row: any) => ({
        region: String(row.region),
        region_code: String(row.region_code),
        farmers: toNumber(row.farmers),
      })),
    [charts.a2cLoansByRegion]
  )

  const locations = useMemo(
    () =>
      (charts.a2cLocationSummary || []).map((row: any) => ({
        woreda: String(row.woreda),
        zone: String(row.zone),
        region: String(row.region),
        farmers: toNumber(row.farmers),
        applications: toNumber(row.applications),
        loansApproved: toNumber(row.loans_approved),
        loanValue: toNumber(row.loan_value),
      })),
    [charts.a2cLocationSummary]
  )

  const locationValueMax = locations.reduce((acc: number, row: { loanValue: number }) => Math.max(acc, row.loanValue), 0)
  const woredasCovered = locations.length

  const consentSegments = useMemo(
    () =>
      (charts.a2cConsentStatus || [])
        .map((row: any) => ({
          name: STATUS_LABELS[String(row.status)] || String(row.status),
          value: toNumber(row.requests),
          sub: formatFull(toNumber(row.requests)),
          color: CONSENT_COLORS[String(row.status)] || BRIGHT.blue,
        }))
        .filter((segment: { value: number }) => segment.value > 0),
    [charts.a2cConsentStatus]
  )

  const applicationSegments = useMemo(
    () =>
      (charts.a2cApplicationStatus || [])
        .map((row: any) => ({
          name: STATUS_LABELS[String(row.status)] || String(row.status),
          value: toNumber(row.applications),
          sub: formatFull(toNumber(row.applications)),
          color: APPLICATION_COLORS[String(row.status)] || BRIGHT.blue,
        }))
        .filter((segment: { value: number }) => segment.value > 0),
    [charts.a2cApplicationStatus]
  )

  const products = useMemo(
    () =>
      (charts.a2cLoanProducts || []).map((row: any) => ({
        name: String(row.product),
        applications: toNumber(row.applications),
        loanValue: toNumber(row.loan_value),
      })),
    [charts.a2cLoanProducts]
  )

  const productValueTotal = products.reduce((acc: number, row: { loanValue: number }) => acc + row.loanValue, 0)

  const trend = useMemo(
    () =>
      (charts.a2cLoanTrend || []).map((row: any) => ({
        month: String(row.month),
        applications: toNumber(row.applications),
        loansApproved: toNumber(row.loans_approved),
      })),
    [charts.a2cLoanTrend]
  )

  const datasets = useMemo(
    () =>
      (charts.a2cDataShares || []).map((row: any) => ({
        name: String(row.dataset),
        shares: toNumber(row.shares),
        delivered: toNumber(row.delivered),
        failed: toNumber(row.failed),
        records: toNumber(row.records),
      })),
    [charts.a2cDataShares]
  )

  const datasetShareMax = datasets.reduce((acc: number, row: { shares: number }) => Math.max(acc, row.shares), 0)

  // Delivery failures block an assessment outright, so they lead as critical.
  const shareFaults = useMemo(
    () =>
      (charts.a2cDataShareFaults || []).map((row: any) => ({
        fault: String(row.fault),
        provider: String(row.provider),
        dataset: String(row.dataset),
        records: toNumber(row.records),
      })),
    [charts.a2cDataShareFaults]
  )

  const declineReasons = useMemo(
    () =>
      (charts.a2cDeclineReasons || []).map((row: any) => ({
        name: String(row.reason),
        applications: toNumber(row.applications),
      })),
    [charts.a2cDeclineReasons]
  )

  const declineMax = declineReasons.reduce(
    (acc: number, row: { applications: number }) => Math.max(acc, row.applications),
    0
  )

  const providerFaults = providers.reduce((acc: number, row: { faults: number }) => acc + row.faults, 0)

  const share = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)

  if (error) {
    return (
      <RegistryCard title="A2C — Access to Credit">
        <div className="px-4 pb-5 pt-3 text-[12px]" style={{ color: REGISTRY_COLORS.red }}>
          Failed to load A2C data: {error}
        </div>
      </RegistryCard>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 @[860px]:grid @[860px]:grid-rows-[auto_minmax(0,168fr)_minmax(0,200fr)_minmax(0,122fr)_auto]">
      {/* Band 1 — the credit pipeline end to end */}
      <section className="grid flex-none grid-cols-2 gap-3 @[640px]:grid-cols-4 @[1180px]:grid-cols-8">
        <RegistryStat
          icon={<Landmark className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          tint="blue"
          size="lg"
          value={formatFull(providersOnboarded)}
          label="Credit Providers"
          note={`of ${formatFull(providersTotal)} · ${formatFull(providersOnboarding)} onboarding`}
          loading={loading}
        />
        <RegistryStat
          icon={<FileClock className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          tint="violet"
          size="lg"
          value={formatFull(consentRequests)}
          label="Consent Requests"
          note={`${formatFull(farmersEnrolled)} farmers enrolled`}
          loading={loading}
        />
        <RegistryStat
          icon={<ShieldCheck className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          tint="green"
          size="lg"
          value={formatFull(consentsApproved)}
          label="Approved Consents"
          note={`${consentApprovalRate.toFixed(1)}% granted`}
          loading={loading}
        />
        <RegistryStat
          icon={<FileCheck2 className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.sky}
          iconColor={BRIGHT.sky}
          tint="teal"
          size="lg"
          value={formatFull(applicationsInProgress)}
          label="Applications Underway"
          note={`of ${formatFull(applicationsTotal)} lodged`}
          loading={loading}
        />
        <RegistryStat
          icon={<Files className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.teal}
          tint="teal"
          size="lg"
          value={formatFull(dataSharesDelivered)}
          label="Registry Datasets Sent"
          note={`${formatFull(recordsShared)} records shared`}
          loading={loading}
        />
        <RegistryStat
          icon={<BadgeCheck className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          tint="green"
          size="lg"
          value={formatFull(loansApproved)}
          label="Loans Approved"
          note={`${loanApprovalRate.toFixed(1)}% approval rate`}
          loading={loading}
        />
        <RegistryStat
          icon={<AlertTriangle className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          tint={openDecisions > 0 ? "red" : "green"}
          size="lg"
          value={formatFull(openDecisions)}
          valueColor={openDecisions > 0 ? BRIGHT.crimson : undefined}
          label="Declined & Pending"
          note={`${formatFull(loansDeclined)} declined · ${formatFull(loansPending)} pending`}
          loading={loading}
        />
        <RegistryStat
          icon={<Banknote className="h-6 w-6" strokeWidth={2.5} />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          tint="amber"
          size="lg"
          value={etb(loanValueApproved)}
          label="Loan Value Facilitated"
          note={`${etb(averageLoan)} average loan`}
          loading={loading}
        />
      </section>

      {/* Band 2 — where the money landed, and how the funnel converts */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[2.9fr_1.75fr_1.75fr_1.9fr]">
        <RegistryCard
          dense
          icon={<Map className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          title="Loan Distribution"
          subtitle={
            loading
              ? "Loading loan distribution…"
              : `Approved value by location · ${formatFull(woredasCovered)} woreda${woredasCovered === 1 ? "" : "s"} · click to drill down`
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
            popOutTitle="Loan Distribution"
            valueLabel="ETB approved"
            valueFormatter={(value: number) => formatCompact(value)}
            childChartKeys={A2C_CHILD_CHARTS}
            currentFilters={filters}
            onFilterChange={onMapFilterChange}
            farmerData={loansByRegion}
            geoJsonData={geoJsonData}
          />
        </RegistryCard>

        <RegistryCard
          dense
          icon={<ShieldCheck className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.violet}
          iconColor={BRIGHT.violet}
          title="Consent Outcomes"
          subtitle={`${formatFull(consentRequests)} requests raised by providers`}
          className="flex min-h-[220px] flex-col @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 items-center"
        >
          <RegistryDonut
            subInline
            ringSize={104}
            className="w-full"
            segments={consentSegments}
            centerValue={formatFull(consentsApproved)}
            centerLabel="Approved"
            totalLabel="Granted"
            totalValue={`${consentApprovalRate.toFixed(1)}% of ${formatFull(consentRequests)}`}
          />
        </RegistryCard>

        <RegistryCard
          dense
          icon={<PieChart className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="Loan Book by Status"
          subtitle={`${formatFull(applicationsTotal)} applications · ${etb(loanValueRequested)} requested`}
          className="flex min-h-[220px] flex-col @[860px]:min-h-0"
          bodyClassName="flex min-h-0 flex-1 items-center"
        >
          <RegistryDonut
            subInline
            ringSize={104}
            className="w-full"
            segments={applicationSegments}
            centerValue={formatFull(loansApproved)}
            centerLabel="Approved"
            totalLabel="Value"
            totalValue={etb(loanValueApproved)}
          />
        </RegistryCard>

        <RegistryCard
          dense
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.teal}
          title="Credit Pipeline"
          subtitle="Conversion at each consent gate"
          className="flex min-h-0 flex-col"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[10px] px-3 pb-2.5 pt-2"
        >
          <SegmentRow
            icon={<FileClock className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.violet}
            iconColor={BRIGHT.violet}
            label="Consent requested"
            value={formatFull(consentRequests)}
            share="(100%)"
          />
          <SegmentRow
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.green}
            iconColor={BRIGHT.green}
            label="Consent granted"
            value={formatFull(consentsApproved)}
            share={`(${share(consentsApproved, consentRequests).toFixed(1)}%)`}
          />
          <SegmentRow
            icon={<Files className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.teal}
            iconColor={BRIGHT.teal}
            label="Registry data delivered"
            value={formatFull(dataSharesDelivered)}
            share={`(${share(dataSharesDelivered, dataSharesTotal).toFixed(1)}%)`}
          />
          <SegmentRow
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            iconBg={BRIGHT_SOFT.blue}
            iconColor={BRIGHT.blue}
            label="Loan approved"
            value={formatFull(loansApproved)}
            share={`(${share(loansApproved, consentRequests).toFixed(1)}%)`}
          />
        </RegistryCard>
      </section>

      {/* Band 3 — lenders, delivery faults, momentum */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[3.5fr_2.4fr_2.3fr]">
        <RegistryCard
          dense
          icon={<Landmark className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="Onboarded Credit Providers"
          subtitle={`${formatFull(providersOnboarded)} live lenders · ${formatFull(providersOnboarding)} in integration`}
          className="flex min-h-[240px] flex-col overflow-hidden @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-1"
        >
          {providers.length === 0 ? (
            <EmptyPanel message="No credit providers onboarded" />
          ) : (
            <div>
              <div
                className="grid grid-cols-[minmax(0,1.5fr)_44px_44px_66px_46px_auto] gap-2 border-b pb-1 text-[9.5px]"
                style={{ borderColor: REGISTRY_COLORS.line2, color: REGISTRY_COLORS.muted }}
              >
                <span>Provider</span>
                <span className="text-right">Apps</span>
                <span className="text-right">Appr.</span>
                <span className="text-right">Value</span>
                <span className="text-right">Faults</span>
                <span className="text-right">Status</span>
              </div>
              {providers.map((row: any) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[minmax(0,1.5fr)_44px_44px_66px_46px_auto] items-center gap-2 py-[3px] text-[10.5px]"
                  style={{ color: REGISTRY_COLORS.ink2 }}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="grid h-4 w-4 flex-none self-center place-items-center rounded-[5px]"
                      style={{
                        background: row.status === "ACTIVE" ? BRIGHT_SOFT.blue : BRIGHT_SOFT.amber,
                        color: row.status === "ACTIVE" ? BRIGHT.blue : BRIGHT.amber,
                      }}
                    >
                      {PROVIDER_TYPE_ICONS[row.providerType] || <Building2 className="h-3 w-3" />}
                    </span>
                    <span
                      className="flex-none font-semibold"
                      style={{ color: REGISTRY_COLORS.ink }}
                      title={`${row.name} · ${row.integration}`}
                    >
                      {row.shortName}
                    </span>
                    <span className="truncate text-[9px]" style={{ color: REGISTRY_COLORS.muted }}>
                      {row.providerType}
                    </span>
                  </span>
                  <span className="text-right">{formatFull(row.applications)}</span>
                  <span className="text-right font-semibold" style={{ color: REGISTRY_COLORS.ink }}>
                    {formatFull(row.loansApproved)}
                  </span>
                  <span className="text-right font-semibold" style={{ color: REGISTRY_COLORS.ink }}>
                    {formatCompact(row.loanValue)}
                  </span>
                  <span className="text-right">
                    <FaultBadge count={row.faults} />
                  </span>
                  <span className="text-right">
                    <ProviderPill status={row.status} />
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
          title="Data Sharing Faults"
          subtitle={`${formatFull(dataSharesFailed)} payloads failed of ${formatFull(dataSharesTotal)} sent`}
          actions={<CriticalCountChip count={shareFaults.length} noun="failing" />}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[5px] px-2.5 pb-2 pt-1.5"
        >
          {shareFaults.length === 0 ? (
            <EmptyPanel message="Every registry payload delivered" />
          ) : (
            <>
              {shareFaults.slice(0, 5).map((row: any) => (
                <FaultAlert
                  key={`${row.provider}-${row.dataset}-${row.fault}`}
                  severity="danger"
                  title={row.fault}
                  context={`${row.provider} · ${row.dataset}`}
                  value={formatFull(row.records)}
                />
              ))}
              {shareFaults.length > 5 && (
                <span className="px-1 text-[9.5px]" style={{ color: REGISTRY_COLORS.muted }}>
                  +{shareFaults.length - 5} further delivery failures
                </span>
              )}
            </>
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.blue}
          iconColor={BRIGHT.blue}
          title="Applications & Approvals"
          subtitle="Loan applications lodged per month"
          className="flex min-h-[200px] flex-col @[860px]:min-h-0"
          bodyClassName="min-h-0 flex-1 px-1 pb-1 pt-1"
        >
          {trend.length === 0 ? (
            <EmptyPanel message="No application history" className="px-3 pb-3" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="a2c-applications-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.blueSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.blueSoft} stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="a2c-approvals-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRIGHT.greenSoft} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={BRIGHT.greenSoft} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REGISTRY_COLORS.line2} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={18}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={26}
                  tick={{ fontSize: 9.5, fill: REGISTRY_COLORS.muted }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${REGISTRY_COLORS.line}`, fontSize: 11 }}
                  formatter={(value: any, name: any) => [
                    formatFull(toNumber(value)),
                    name === "applications" ? "Applications" : "Approved",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke={BRIGHT.blue}
                  strokeWidth={2}
                  fill="url(#a2c-applications-trend)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.blue, strokeWidth: 1.4 }}
                  activeDot={{ r: 3.5, fill: BRIGHT.blue, stroke: "#fff", strokeWidth: 1.6 }}
                />
                <Area
                  type="monotone"
                  dataKey="loansApproved"
                  stroke={BRIGHT.green}
                  strokeWidth={2}
                  fill="url(#a2c-approvals-trend)"
                  dot={{ r: 1.8, fill: "#fff", stroke: BRIGHT.green, strokeWidth: 1.4 }}
                  activeDot={{ r: 3.5, fill: BRIGHT.green, stroke: "#fff", strokeWidth: 1.6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </RegistryCard>
      </section>

      {/* Band 4 — locations, products, datasets, declines */}
      <section className="grid min-h-0 flex-none grid-cols-1 gap-3 @[720px]:grid-cols-2 @[860px]:grid-cols-[2.5fr_2.1fr_2.2fr_2.2fr]">
        <RegistryCard
          dense
          icon={<MapPin className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.green}
          iconColor={BRIGHT.green}
          title="Programme Locations"
          subtitle={`${formatFull(farmersEnrolled)} farmers enrolled across ${formatFull(woredasCovered)} woredas`}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {locations.length === 0 ? (
            <EmptyPanel message="No enrolled locations" />
          ) : (
            locations.map((row: any, index: number) => (
              <ProgressRow
                key={row.woreda}
                icon={<MapPin className="h-3 w-3" />}
                iconColor={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                label={`${row.woreda} · ${formatFull(row.farmers)} farmers`}
                value={formatCompact(row.loanValue)}
                percent={share(row.loanValue, locationValueMax)}
                color={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                barWidth="48px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Wallet className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.amber}
          iconColor={BRIGHT.amber}
          title="Loan Products"
          subtitle={`${etb(productValueTotal)} approved across ${formatFull(products.length)} products`}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {products.length === 0 ? (
            <EmptyPanel message="No loan products" />
          ) : (
            products.map((row: any, index: number) => (
              <ProgressRow
                key={row.name}
                icon={PRODUCT_ICONS[row.name] || <Banknote className="h-3 w-3" />}
                iconColor={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                label={`${row.name} · ${formatFull(row.applications)} apps`}
                value={formatCompact(row.loanValue)}
                percent={share(row.loanValue, productValueTotal)}
                color={BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                barWidth="48px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<Files className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.teal}
          iconColor={BRIGHT.teal}
          title="Registry Datasets Shared"
          subtitle={`${formatFull(recordsShared)} records delivered to lenders`}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {datasets.length === 0 ? (
            <EmptyPanel message="No datasets shared" />
          ) : (
            datasets.map((row: any, index: number) => (
              <ProgressRow
                key={row.name}
                icon={DATASET_ICONS[row.name] || <Files className="h-3 w-3" />}
                iconColor={row.failed > 0 ? BRIGHT.crimson : BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                label={row.failed > 0 ? `${row.name} · ${formatFull(row.failed)} failed` : row.name}
                value={formatFull(row.shares)}
                percent={share(row.shares, datasetShareMax)}
                color={row.failed > 0 ? BRIGHT.crimson : BRIGHT_SERIES[index % BRIGHT_SERIES.length]}
                barWidth="44px"
              />
            ))
          )}
        </RegistryCard>

        <RegistryCard
          dense
          icon={<ThumbsDown className="h-3 w-3" />}
          iconBg={BRIGHT_SOFT.red}
          iconColor={BRIGHT.crimson}
          title="Why Loans Were Declined"
          subtitle={`${formatFull(loansDeclined)} declined · ${formatFull(loansPending)} awaiting a decision`}
          actions={<CriticalCountChip count={loansDeclined} noun="declined" />}
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="grid min-h-0 flex-1 content-start gap-[7px] px-3 pb-2.5 pt-2"
        >
          {declineReasons.length === 0 ? (
            <EmptyPanel message="No declined applications" />
          ) : (
            declineReasons.map((row: any) => (
              <ProgressRow
                key={row.name}
                icon={DECLINE_ICONS[row.name] || <ShieldX className="h-3 w-3" />}
                iconColor={BRIGHT.crimson}
                label={row.name}
                value={formatFull(row.applications)}
                percent={share(row.applications, declineMax)}
                color={BRIGHT.crimson}
                barWidth="34px"
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
        <strong className="font-semibold">Sample data:</strong>
        <span className="min-w-0 flex-1 truncate">
          A2C has no live feed yet. Figures come from data/a2c/*.sql — {formatFull(farmersEnrolled)} farmers in Jimma,
          Gumbichu and Adea — and are not affected by the registry filters.
          {providerFaults > 0 ? ` ${formatFull(providerFaults)} delivery faults across lenders.` : ""}
        </span>
        <ExportDataButton
          filePrefix="a2c-access-to-credit"
          captureTargetId="dashboard-a2c"
          csvSections={() => [
            { name: "Credit providers", rows: charts.a2cProviders || [] },
            { name: "Programme locations", rows: charts.a2cLocationSummary || [] },
            { name: "Loans by region", rows: charts.a2cLoansByRegion || [] },
            { name: "Consent status", rows: charts.a2cConsentStatus || [] },
            { name: "Application status", rows: charts.a2cApplicationStatus || [] },
            { name: "Loan products", rows: charts.a2cLoanProducts || [] },
            { name: "Applications per month", rows: charts.a2cLoanTrend || [] },
            { name: "Registry datasets shared", rows: charts.a2cDataShares || [] },
            { name: "Data sharing faults", rows: charts.a2cDataShareFaults || [] },
            { name: "Decline reasons", rows: charts.a2cDeclineReasons || [] },
          ]}
        />
      </div>
    </div>
  )
}
