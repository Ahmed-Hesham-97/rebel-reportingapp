import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DeltaMetric } from "@/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { SectionPicker } from "@/components/reports/section-picker";
import { normalizeSections, sectionsForSources } from "@/lib/reports/sections";

type SourceData = { revenue?: DeltaMetric; emailRevenue?: DeltaMetric; spend?: DeltaMetric; roas?: DeltaMetric; orders?: DeltaMetric; aov?: DeltaMetric; dailyRevenue?: Array<{ date: string; current: number; previous: number }> };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { data: report } = await supabaseAdmin().from("report_snapshots").select("id,client_id,report_month,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,included_sections,delivered_at").eq("id", id).maybeSingle();
  if (!report) notFound();
  const { data: client } = await supabaseAdmin().from("clients").select("klaviyo_api_key,meta_access_token,meta_ad_account_id").eq("id", report.client_id).maybeSingle();
  const sources = { shopify: true, klaviyo: Boolean(client?.klaviyo_api_key), meta: Boolean(client?.meta_access_token && client?.meta_ad_account_id) };
  const available = sectionsForSources(sources);
  const shopify = (report.shopify_data ?? {}) as SourceData;
  const klaviyo = (report.klaviyo_data ?? {}) as SourceData;
  const meta = (report.meta_data ?? {}) as SourceData;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${report.report_month}T12:00:00Z`));
  return <div className="p-6 lg:p-10"><div className="mx-auto max-w-6xl">
    <div className="mb-6 flex items-center justify-between gap-3"><Link href={`/clients/${report.client_id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to client</Link></div>
    <header className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-red-500">Internal review</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{label}</h1><p className="mt-1 text-sm text-slate-500">{report.delivered_at ? `Sent to the client on ${new Date(report.delivered_at).toLocaleDateString("en-US")}.` : "Not sent yet. Review the data below, then choose what the client sees."}</p></div><StatusBadge status={report.status} /></header>
    {report.error_log && <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Some data sources were unavailable. The report contains the successful sources.</div>}
    <Card className="mb-6"><CardHeader><CardTitle>Executive summary</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm text-slate-600"><li>Report generated for {label} across Shopify, Klaviyo, and Meta Ads.</li><li>Use the month-over-month cards below to identify the strongest movement.</li><li>{report.status === "partial" ? "Review the source warning before sharing this report with the client." : "All configured sources returned successfully."}</li></ul></CardContent></Card>
    <Card className="mb-6"><CardHeader><CardTitle>Shopify revenue trend</CardTitle></CardHeader><CardContent><RevenueChart data={shopify.dailyRevenue ?? []} /></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard source="Shopify revenue" metric={shopify.revenue} currency />
      <MetricCard source="Email revenue" metric={klaviyo.emailRevenue} currency />
      <MetricCard source="Meta ROAS" metric={meta.roas} />
      <MetricCard source="Shopify orders" metric={shopify.orders} />
      <MetricCard source="Shopify AOV" metric={shopify.aov} currency />
      <MetricCard source="Meta ad spend" metric={meta.spend} currency />
    </div>
    <Card className="mt-6"><CardHeader><CardTitle>Build the client PDF</CardTitle><p className="text-sm text-slate-500">Everything above stays internal. Tick the sections to include, preview the result, then send it. Your choice becomes this client&apos;s default for next month.</p></CardHeader><CardContent><SectionPicker reportId={id} initialSections={normalizeSections(report.included_sections).filter((section) => available.includes(section))} availableSections={available} deliveredAt={report.delivered_at} canDeliver={user.role === "admin"} /></CardContent></Card>
    <Card className="mt-6"><CardHeader><CardTitle>Data source status</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3">{[{ name: "Shopify", data: report.shopify_data, connected: sources.shopify }, { name: "Klaviyo", data: report.klaviyo_data, connected: sources.klaviyo }, { name: "Meta Ads", data: report.meta_data, connected: sources.meta }].map((source) => <div key={source.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm"><span>{source.name}</span>{source.connected ? <StatusBadge status={source.data ? "completed" : "failed"} /> : <span className="text-xs font-medium text-slate-500">Not connected</span>}</div>)}</div></CardContent></Card>
  </div></div>;
}

function MetricCard({ source, metric, currency = false }: { source: string; metric?: DeltaMetric; currency?: boolean }) {
  const current = metric?.current;
  const change = metric?.changePct;
  const positive = typeof change === "number" && change >= 0;
  return <Card><CardContent className="p-5"><p className="text-sm text-slate-500">{source}</p><p className="mt-2 text-2xl font-bold">{currency ? formatCurrency(current) : current === null || current === undefined ? "—" : current.toFixed(2)}</p><div className="mt-3 flex items-center gap-1 text-xs font-semibold">{typeof change === "number" ? <>{positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {formatPercent(change)} vs previous month</> : "No comparison available"}</div></CardContent></Card>;
}
