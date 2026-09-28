import "server-only";

import { IntegrationError } from "@/lib/integrations/retry";
import { requestJson } from "@/lib/integrations/http";
import { metric, type ReportPeriod } from "@/lib/reports/date-range";
import type { CampaignPerformance, KlaviyoMetrics } from "@/types/report";

type KlaviyoList<T> = { data?: Array<{ id: string; attributes?: T }>; errors?: Array<{ detail?: string }> };
type KlaviyoAttributes = { name?: string; status?: string };

/** Keep on a widely-supported revision; channel filter is still required for campaigns. */
const REVISION = "2024-10-15";

function headers(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey.trim()}`,
    revision: REVISION,
    Accept: "application/json",
  };
}

function klaviyoUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://a.klaviyo.com/api/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export async function testKlaviyoConnection(apiKey: string) {
  const key = apiKey.trim();
  if (!key) throw new Error("Enter a Klaviyo private API key (pk_…).");
  const response = await requestJson<KlaviyoList<{ company_name?: string }>>("klaviyo", klaviyoUrl("accounts/"), {
    headers: headers(key),
  });
  if (response.errors?.length) throw new Error(response.errors[0].detail ?? "Klaviyo connection failed");
  return { account: response.data?.[0]?.attributes?.company_name ?? "Klaviyo account" };
}

async function listPerformers(apiKey: string, path: string, params: Record<string, string> = {}): Promise<CampaignPerformance[]> {
  const response = await requestJson<KlaviyoList<KlaviyoAttributes>>("klaviyo", klaviyoUrl(path, { "page[size]": "5", ...params }), {
    headers: headers(apiKey),
  });
  return (response.data ?? []).slice(0, 3).map((item) => ({
    id: item.id,
    name: item.attributes?.name ?? "Untitled",
    revenue: null,
  }));
}

export async function fetchKlaviyoMetrics(apiKey: string, period: ReportPeriod): Promise<KlaviyoMetrics> {
  void period;
  const key = apiKey.trim();
  // Prove the key works before listing. Invalid keys usually 401/403; bad list params are 400.
  await testKlaviyoConnection(key);

  const [flowsResult, campaignsResult] = await Promise.allSettled([
    listPerformers(key, "flows/"),
    listPerformers(key, "campaigns/", { filter: "equals(messages.channel,'email')" }),
  ]);

  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const campaigns = campaignsResult.status === "fulfilled" ? campaignsResult.value : [];

  if (flowsResult.status === "rejected" && campaignsResult.status === "rejected") {
    const reason = flowsResult.reason instanceof Error ? flowsResult.reason.message : "request failed";
    throw new IntegrationError(reason, flowsResult.reason instanceof IntegrationError ? flowsResult.reason.status : 400);
  }

  const unavailable = metric(null, null);
  return {
    currency: "USD",
    emailRevenue: unavailable,
    sent: unavailable,
    delivered: unavailable,
    opened: unavailable,
    clicked: unavailable,
    openRate: unavailable,
    clickRate: unavailable,
    conversionRate: unavailable,
    topFlows: flows,
    topCampaigns: campaigns,
    newSubscribers: unavailable,
    unsubscribes: unavailable,
    sms: { enabled: false, sent: unavailable, clicked: unavailable, revenue: unavailable },
  };
}
