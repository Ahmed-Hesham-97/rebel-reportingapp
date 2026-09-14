import "server-only";

import { configuredSources, getClient, getClientSecrets } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { testShopifyConnection, fetchShopifyMetrics } from "@/lib/integrations/shopify";
import { fetchKlaviyoMetrics } from "@/lib/integrations/klaviyo";
import { fetchMetaMetrics } from "@/lib/integrations/meta";
import { getReportMonthPeriod } from "@/lib/reports/date-range";
import { recordActivity } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { normalizeSections, sectionsForSources } from "@/lib/reports/sections";
import type { SourceName } from "@/types/report";

export async function generateReport(clientId: string, requestedMonth: string, userId?: string | null) {
  const client = await getClient(clientId);
  if (!client) throw new Error("Client not found");
  const secrets = await getClientSecrets(client);
  const shopifyToken = secrets.shopifyToken;
  if (!shopifyToken) throw new Error("Connect the Shopify store before generating a report");
  const sources = configuredSources(client);
  const available = sectionsForSources(sources);
  const defaultSections = normalizeSections(client.default_sections).filter((id) => available.includes(id));
  const existing = await supabaseAdmin().from("report_snapshots").select("id").eq("client_id", clientId).eq("report_month", requestedMonth).maybeSingle();
  const { data: snapshot, error: createError } = await supabaseAdmin().from("report_snapshots").upsert({
    id: existing.data?.id,
    client_id: clientId,
    report_month: requestedMonth,
    status: "processing",
    error_log: null,
    included_sections: defaultSections,
    delivered_at: null,
  }, { onConflict: "client_id,report_month" }).select("id").single();
  if (createError || !snapshot) throw new Error("Unable to start report");
  const connection = await testShopifyConnection(client.shopify_store_url, shopifyToken).catch((error) => {
    logger.warn({ clientId, error: error instanceof Error ? error.message : "unknown" }, "shopify timezone lookup failed");
    return { timezone: "UTC", currency: "USD" };
  });
  const period = getReportMonthPeriod(requestedMonth, connection.timezone);
  // Only connected sources are fetched; a missing integration is not a failure.
  const jobs: Array<[SourceName, Promise<unknown>]> = [
    ["shopify", fetchShopifyMetrics(client.shopify_store_url, shopifyToken, period)],
  ];
  if (sources.klaviyo && secrets.klaviyoApiKey) jobs.push(["klaviyo", fetchKlaviyoMetrics(secrets.klaviyoApiKey, period)]);
  if (sources.meta && secrets.metaAccessToken && client.meta_ad_account_id) {
    jobs.push(["meta", fetchMetaMetrics(secrets.metaAccessToken, client.meta_ad_account_id, period)]);
  }
  const settled = await Promise.allSettled(jobs.map(([, job]) => job));
  const errors: string[] = [];
  const values: Record<SourceName, unknown | null> = { shopify: null, klaviyo: null, meta: null };
  settled.forEach((result, index) => {
    const source = jobs[index][0];
    if (result.status === "fulfilled") values[source] = result.value;
    else errors.push(`${source}: ${result.reason instanceof Error ? result.reason.message : "request failed"}`);
  });
  const status = errors.length === 0 ? "completed" : Object.values(values).some(Boolean) ? "partial" : "failed";
  const { error: updateError } = await supabaseAdmin().from("report_snapshots").update({
    shopify_data: values.shopify as never,
    klaviyo_data: values.klaviyo as never,
    meta_data: values.meta as never,
    status,
    error_log: errors.length ? errors.join("\n") : null,
  }).eq("id", snapshot.id);
  if (updateError) throw new Error("Unable to save report");
  // Nothing reaches the client until a team member reviews the data and picks sections.
  await recordActivity("report.generated", { userId, clientId, metadata: { reportMonth: requestedMonth, status } });
  return { id: snapshot.id, status, errors };
}
