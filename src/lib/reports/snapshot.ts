import type { ReportSnapshot, SourceResult, ShopifyMetrics, KlaviyoMetrics, MetaMetrics } from "@/types/report";
import type { Json } from "@/lib/supabase/database.types";
import { getReportMonthPeriod } from "@/lib/reports/date-range";
import { buildExecutiveSummary } from "@/lib/reports/executive-summary";
import { normalizeSections } from "@/lib/reports/sections";

export function toReportSnapshot(row: {
  id: string; client_id: string; report_month: string; shopify_data: Json | null; klaviyo_data: Json | null; meta_data: Json | null;
  status: ReportSnapshot["status"]; pdf_url?: string | null; error_log?: string | null; created_at: string;
  included_sections?: string[] | null; delivered_at?: string | null;
}): ReportSnapshot {
  const source = <T,>(data: Json | null, error?: string): SourceResult<T> => ({
    status: data ? "success" : "failed", data: data as T | null, error, fetchedAt: row.created_at,
  });
  const base = {
    id: row.id, clientId: row.client_id, reportMonth: row.report_month, status: row.status,
    period: getReportMonthPeriod(row.report_month), shopify: source<ShopifyMetrics>(row.shopify_data, row.error_log ?? undefined),
    klaviyo: source<KlaviyoMetrics>(row.klaviyo_data, row.error_log ?? undefined), meta: source<MetaMetrics>(row.meta_data, row.error_log ?? undefined),
    pdfUrl: row.pdf_url ?? null, createdAt: row.created_at,
    includedSections: normalizeSections(row.included_sections), deliveredAt: row.delivered_at ?? null,
  };
  return { ...base, executiveSummary: buildExecutiveSummary(base) };
}
