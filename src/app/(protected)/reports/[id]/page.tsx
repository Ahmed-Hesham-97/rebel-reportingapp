import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DeltaMetric } from "@/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { SectionPicker } from "@/components/reports/section-picker";
import { DeleteReportButton } from "@/components/reports/delete-report-button";
import { normalizeSections, sectionsForSources } from "@/lib/reports/sections";
import { formatReportPeriodLabel } from "@/lib/reports/date-range";

type SourceData = {
  revenue?: DeltaMetric;
  emailRevenue?: DeltaMetric;
  spend?: DeltaMetric;
  roas?: DeltaMetric;
  orders?: DeltaMetric;
  aov?: DeltaMetric;
  dailyRevenue?: Array<{ date: string; current: number; previous: number }>;
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { data: report } = await supabaseAdmin()
    .from("report_snapshots")
    .select("id,client_id,report_month,period_end,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,included_sections,delivered_at")
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();
  const { data: client } = await supabaseAdmin()
    .from("clients")
    .select("name,klaviyo_api_key,meta_access_token,meta_ad_account_id")
    .eq("id", report.client_id)
    .maybeSingle();
  const sources = {
    shopify: true,
    klaviyo: Boolean(client?.klaviyo_api_key),
    meta: Boolean(client?.meta_access_token && client?.meta_ad_account_id),
  };
  const available = sectionsForSources(sources);
  const shopify = (report.shopify_data ?? {}) as SourceData;
  const klaviyo = (report.klaviyo_data ?? {}) as SourceData;
  const meta = (report.meta_data ?? {}) as SourceData;
  const label = formatReportPeriodLabel(report.report_month, report.period_end);
  const connectedNames = [
    sources.shopify ? "Shopify" : null,
    sources.klaviyo ? "Klaviyo" : null,
    sources.meta ? "Meta Ads" : null,
  ].filter(Boolean);

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/clients/${report.client_id}`} className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            <ArrowLeft size={16} /> Back to client
          </Link>
          {user.role === "admin" ? <DeleteReportButton reportId={id} clientId={report.client_id} label={label} /> : null}
        </div>

        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Internal review</p>
            <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">{label}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {client?.name ? `${client.name} · ` : ""}
              Review the data below, then download a PDF with the sections you want.
            </p>
          </div>
          <StatusBadge status={report.status} />
        </header>

        {report.error_log ? (
          <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Some data sources were unavailable.</p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{report.error_log}</pre>
          </div>
        ) : null}

        <Card className="mb-6 overflow-hidden">
          <CardHeader className="bg-[linear-gradient(135deg,rgba(225,29,72,0.08),transparent_55%)]">
            <CardTitle>Executive summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-600">
              <li>
                Report generated for {label}
                {connectedNames.length ? ` using ${connectedNames.join(", ")}.` : "."}
              </li>
              <li>Use the month-over-month cards below to identify the strongest movement.</li>
              <li>
                {!sources.klaviyo || !sources.meta
                  ? "Connect Klaviyo and Meta in client settings to fill the empty channel cards."
                  : report.status === "partial"
                    ? "Review the source warning before sharing this report with the client."
                    : "All configured sources returned successfully."}
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Shopify revenue trend</CardTitle>
            <p className="text-sm text-[var(--muted)]">Daily store revenue for {label}, with the prior month overlaid.</p>
          </CardHeader>
          <CardContent>
            <RevenueChart data={shopify.dailyRevenue ?? []} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard source="Shopify revenue" metric={shopify.revenue} currency />
          <MetricCard
            source="Email revenue"
            metric={klaviyo.emailRevenue}
            currency
            emptyHint={sources.klaviyo ? undefined : "Klaviyo not connected"}
          />
          <MetricCard source="Meta ROAS" metric={meta.roas} emptyHint={sources.meta ? undefined : "Meta not connected"} />
          <MetricCard source="Shopify orders" metric={shopify.orders} />
          <MetricCard source="Shopify AOV" metric={shopify.aov} currency />
          <MetricCard
            source="Meta ad spend"
            metric={meta.spend}
            currency
            emptyHint={sources.meta ? undefined : "Meta not connected"}
          />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Download PDF</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Tick the sections to include, then download. Your selection becomes this client&apos;s default for the next report.
            </p>
          </CardHeader>
          <CardContent>
            <SectionPicker
              reportId={id}
              initialSections={normalizeSections(report.included_sections).filter((section) => available.includes(section))}
              availableSections={available}
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Data source status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "Shopify", data: report.shopify_data, connected: sources.shopify },
                { name: "Klaviyo", data: report.klaviyo_data, connected: sources.klaviyo },
                { name: "Meta Ads", data: report.meta_data, connected: sources.meta },
              ].map((source) => (
                <div key={source.name} className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] p-4 text-sm">
                  <span className="font-medium">{source.name}</span>
                  {source.connected ? (
                    <StatusBadge status={source.data ? "completed" : "failed"} />
                  ) : (
                    <span className="text-xs font-medium text-[var(--muted)]">Not connected</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  source,
  metric,
  currency = false,
  emptyHint,
}: {
  source: string;
  metric?: DeltaMetric;
  currency?: boolean;
  emptyHint?: string;
}) {
  const current = metric?.current;
  const previous = metric?.previous;
  const change = metric?.changePct;
  const positive = typeof change === "number" && change >= 0;
  const value =
    currency ? formatCurrency(current) : current === null || current === undefined ? "—" : formatNumber(current);

  let comparison = "No comparison available";
  if (typeof change === "number") {
    comparison = `${formatPercent(change)} vs previous month`;
  } else if (typeof previous === "number" && previous === 0 && typeof current === "number" && current > 0) {
    comparison = "New vs $0 last month";
  } else if (typeof previous === "number") {
    comparison = currency ? `vs ${formatCurrency(previous)} last month` : `vs ${formatNumber(previous)} last month`;
  } else if (emptyHint) {
    comparison = emptyHint;
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-[var(--muted)]">{source}</p>
        <p className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--ink)]">{value}</p>
        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${typeof change === "number" ? (positive ? "text-emerald-600" : "text-rose-600") : "text-[var(--muted)]"}`}>
          {typeof change === "number" ? positive ? <TrendingUp size={14} /> : <TrendingDown size={14} /> : null}
          {comparison}
        </div>
      </CardContent>
    </Card>
  );
}
