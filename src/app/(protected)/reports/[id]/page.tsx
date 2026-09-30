import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DeltaMetric, ShopifyMetrics } from "@/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent, formatRatePercent } from "@/lib/utils";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { SectionPicker } from "@/components/reports/section-picker";
import { DeleteReportButton } from "@/components/reports/delete-report-button";
import { ManualReportForm } from "@/components/reports/manual-report-form";
import { normalizeManualData } from "@/lib/reports/manual-data";
import { sectionsForSources } from "@/lib/reports/sections";
import { formatReportPeriodLabel } from "@/lib/reports/date-range";

type SourceData = {
  revenue?: DeltaMetric;
  emailRevenue?: DeltaMetric;
  spend?: DeltaMetric;
  roas?: DeltaMetric;
  orders?: DeltaMetric;
  aov?: DeltaMetric;
  dailyRevenue?: Array<{ date: string; current: number; previous: number }>;
  funnel?: ShopifyMetrics["funnel"];
  newCustomers?: DeltaMetric;
  returningCustomers?: DeltaMetric;
  refundRate?: DeltaMetric;
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { data: report } = await supabaseAdmin()
    .from("report_snapshots")
    .select("id,client_id,report_month,period_end,shopify_data,klaviyo_data,meta_data,manual_data,pdf_url,status,error_log,included_sections,delivered_at")
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();
  const { data: client } = await supabaseAdmin()
    .from("clients")
    .select("name,klaviyo_api_key")
    .eq("id", report.client_id)
    .maybeSingle();
  const sources = {
    shopify: true,
    klaviyo: Boolean(client?.klaviyo_api_key),
    meta: false,
  };
  const available = sectionsForSources(sources);
  const shopify = (report.shopify_data ?? {}) as SourceData;
  const klaviyo = (report.klaviyo_data ?? {}) as SourceData;
  const manual = normalizeManualData(report.manual_data);
  // Persist legacy topContentImage → topContentImages so PDFs and future edits use the list field.
  const rawSocial = (report.manual_data as { social?: { topContentImage?: string; topContentImages?: unknown } } | null)?.social;
  if (
    typeof rawSocial?.topContentImage === "string" &&
    rawSocial.topContentImage.trim() &&
    (!Array.isArray(rawSocial.topContentImages) || rawSocial.topContentImages.length === 0)
  ) {
    await supabaseAdmin()
      .from("report_snapshots")
      .update({ manual_data: manual as never })
      .eq("id", id);
  }
  const label = formatReportPeriodLabel(report.report_month, report.period_end);
  const connectedNames = [sources.shopify ? "Shopify" : null, sources.klaviyo ? "Klaviyo" : null].filter(Boolean);
  const funnel = shopify.funnel;

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
              Shopify data is pulled automatically. Fill in the manual sections below, then download the PDF.
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
            <CardTitle>Pulled from Shopify</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Website metrics for {label}
              {connectedNames.length ? ` · also connected: ${connectedNames.filter((n) => n !== "Shopify").join(", ") || "Shopify only"}` : ""}.
            </p>
          </CardHeader>
          <CardContent>
            <RevenueChart data={shopify.dailyRevenue ?? []} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard source="Revenue" metric={shopify.revenue} currency />
          <MetricCard source="Orders" metric={shopify.orders} />
          <MetricCard source="Average order value" metric={shopify.aov} currency />
          <MetricCard source="Sessions" metric={funnel?.sessions} />
          <MetricCard source="Conversion rate" metric={funnel?.conversionRate} percent />
          <MetricCard source="Bounce rate" metric={funnel?.bounceRate} percent />
          <MetricCard source="New customers" metric={shopify.newCustomers} />
          <MetricCard source="Returning customers" metric={shopify.returningCustomers} />
          <MetricCard source="Refund rate" metric={shopify.refundRate} percent />
          <MetricCard
            source="Email revenue"
            metric={klaviyo.emailRevenue}
            currency
            emptyHint={sources.klaviyo ? undefined : "Klaviyo not connected"}
          />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Manual report fields</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Meta Ads, Google Ads, social, and other template fields are entered here — nothing is pulled from an ad account link. Save before downloading the PDF.
            </p>
          </CardHeader>
          <CardContent>
            <ManualReportForm reportId={id} initial={manual} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Download PDF</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Combines pulled Shopify / Klaviyo data with the manual fields above (including Meta Ads). Your section selection becomes this client&apos;s default.
            </p>
          </CardHeader>
          <CardContent>
            <SectionPicker
              reportId={id}
              initialSections={available}
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
                { name: "Shopify", data: report.shopify_data, connected: sources.shopify, mode: "api" as const },
                { name: "Klaviyo", data: report.klaviyo_data, connected: sources.klaviyo, mode: "api" as const },
                { name: "Meta Ads", data: null, connected: true, mode: "manual" as const },
              ].map((source) => (
                <div key={source.name} className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] p-4 text-sm">
                  <span className="font-medium">{source.name}</span>
                  {source.mode === "manual" ? (
                    <span className="text-xs font-medium text-[var(--muted)]">Manual entry</span>
                  ) : source.connected ? (
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
  percent = false,
  emptyHint,
}: {
  source: string;
  metric?: DeltaMetric;
  currency?: boolean;
  percent?: boolean;
  emptyHint?: string;
}) {
  const current = metric?.current;
  const previous = metric?.previous;
  const change = metric?.changePct;
  const positive = typeof change === "number" && change >= 0;
  let value = "—";
  if (current !== null && current !== undefined) {
    if (currency) value = formatCurrency(current);
    else if (percent) value = formatRatePercent(current);
    else value = formatNumber(current);
  }

  let comparison = "No comparison available";
  if (typeof change === "number") {
    comparison = `${formatPercent(change)} vs previous month`;
  } else if (typeof previous === "number" && previous === 0 && typeof current === "number" && current > 0) {
    comparison = "New vs $0 last month";
  } else if (typeof previous === "number") {
    if (currency) comparison = `vs ${formatCurrency(previous)} last month`;
    else if (percent) comparison = `vs ${formatRatePercent(previous)} last month`;
    else comparison = `vs ${formatNumber(previous)} last month`;
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
