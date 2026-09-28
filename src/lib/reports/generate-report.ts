import "server-only";

import { configuredSources, getClient, getClientSecrets } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { testShopifyConnection, fetchShopifyMetrics } from "@/lib/integrations/shopify";
import { fetchKlaviyoMetrics } from "@/lib/integrations/klaviyo";
import { fetchMetaMetrics } from "@/lib/integrations/meta";
import { getReportMonthPeriod, getReportRangePeriod } from "@/lib/reports/date-range";
import { recordActivity } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { IntegrationError } from "@/lib/integrations/retry";
import { normalizeSections, sectionsForSources } from "@/lib/reports/sections";
import type { SourceName } from "@/types/report";

function sourceErrorMessage(source: SourceName, error: unknown) {
  const raw = error instanceof Error ? error.message : "request failed";
  if (error instanceof IntegrationError) {
    if (error.status === 401) {
      return source === "shopify"
        ? "Shopify rejected the access token (401). Open Settings → Connect with Shopify again (or paste a fresh Admin API token and Save)."
        : `${source} rejected the API credentials (401). Paste a fresh key in Settings and Save.`;
    }
    if (error.status === 403) {
      return `${source} token is missing required scopes (403). Reconnect and approve all requested permissions.`;
    }
    if (error.status === 400) {
      return raw.includes(":") ? raw : `${source} rejected the request (400). Check the saved credentials in Settings.`;
    }
    return raw.includes(source) ? raw : `${source} request failed (${error.status})`;
  }
  return `${source}: ${raw}`;
}

export async function generateReport(
  clientId: string,
  requestedMonth: string,
  userId?: string | null,
  periodEnd?: string | null,
) {
  const client = await getClient(clientId);
  if (!client) throw new Error("Client not found");
  const secrets = await getClientSecrets(client);
  const shopifyToken = secrets.shopifyToken;
  if (!shopifyToken) throw new Error("Connect the Shopify store before generating a report");
  const sources = configuredSources(client);
  const available = sectionsForSources(sources);
  const defaultSections = normalizeSections(client.default_sections).filter((id) => available.includes(id));

  const connection = await testShopifyConnection(client.shopify_store_url, shopifyToken).catch((error) => {
    logger.warn({ clientId, error: error instanceof Error ? error.message : "unknown" }, "shopify timezone lookup failed");
    return { timezone: "UTC", currency: "USD" };
  });
  const period = periodEnd
    ? getReportRangePeriod(requestedMonth, periodEnd, connection.timezone)
    : getReportMonthPeriod(requestedMonth, connection.timezone);

  const existing = await supabaseAdmin()
    .from("report_snapshots")
    .select("id")
    .eq("client_id", clientId)
    .eq("report_month", period.reportMonth)
    .eq("period_end", period.periodEnd)
    .maybeSingle();
  const { data: snapshot, error: createError } = await supabaseAdmin()
    .from("report_snapshots")
    .upsert(
      {
        id: existing.data?.id,
        client_id: clientId,
        report_month: period.reportMonth,
        period_end: period.periodEnd,
        status: "processing",
        error_log: null,
        included_sections: defaultSections,
        delivered_at: null,
      },
      { onConflict: "client_id,report_month,period_end" },
    )
    .select("id")
    .single();
  if (createError || !snapshot) throw new Error("Unable to start report");

  const errors: string[] = [];
  const values: Record<SourceName, unknown | null> = { shopify: null, klaviyo: null, meta: null };

  // Shopify first and alone — optional channels run only after it settles.
  try {
    values.shopify = await fetchShopifyMetrics(client.shopify_store_url, shopifyToken, period);
  } catch (error) {
    errors.push(sourceErrorMessage("shopify", error));
    logger.error({ clientId, error }, "shopify report fetch failed");
  }

  const optional: Array<[SourceName, Promise<unknown>]> = [];
  if (sources.klaviyo && secrets.klaviyoApiKey) optional.push(["klaviyo", fetchKlaviyoMetrics(secrets.klaviyoApiKey, period)]);
  if (sources.meta && secrets.metaAccessToken && client.meta_ad_account_id) {
    optional.push(["meta", fetchMetaMetrics(secrets.metaAccessToken, client.meta_ad_account_id, period)]);
  }
  if (optional.length) {
    const settled = await Promise.allSettled(optional.map(([, job]) => job));
    settled.forEach((result, index) => {
      const source = optional[index][0];
      if (result.status === "fulfilled") values[source] = result.value;
      else errors.push(sourceErrorMessage(source, result.reason));
    });
  }

  const status = errors.length === 0 ? "completed" : values.shopify || values.klaviyo || values.meta ? "partial" : "failed";
  const { error: updateError } = await supabaseAdmin()
    .from("report_snapshots")
    .update({
      shopify_data: values.shopify as never,
      klaviyo_data: values.klaviyo as never,
      meta_data: values.meta as never,
      status,
      error_log: errors.length ? errors.join("\n") : null,
    })
    .eq("id", snapshot.id);
  if (updateError) throw new Error("Unable to save report");
  await recordActivity("report.generated", {
    userId,
    clientId,
    metadata: { reportMonth: period.reportMonth, periodEnd: period.periodEnd, status },
  });
  return { id: snapshot.id, status, errors, reportMonth: period.reportMonth, periodEnd: period.periodEnd };
}
