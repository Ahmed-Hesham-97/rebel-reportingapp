import "server-only";

import { requestJson } from "@/lib/integrations/http";
import { metric, type ReportPeriod } from "@/lib/reports/date-range";
import type { CampaignPerformance, KlaviyoMetrics } from "@/types/report";

type KlaviyoList<T> = { data?: Array<{ id: string; attributes?: T }>; errors?: Array<{ detail?: string }> };
type KlaviyoAttributes = { name?: string; status?: string };

const headers = (apiKey: string) => ({
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  revision: "2024-10-15",
});

export async function testKlaviyoConnection(apiKey: string) {
  const response = await requestJson<KlaviyoList<{ company_name?: string }>>("klaviyo", "https://a.klaviyo.com/api/accounts/", { headers: headers(apiKey) });
  if (response.errors?.length) throw new Error(response.errors[0].detail ?? "Klaviyo connection failed");
  return { account: response.data?.[0]?.attributes?.company_name ?? "Klaviyo account" };
}

async function listPerformers(apiKey: string, path: string): Promise<CampaignPerformance[]> {
  const response = await requestJson<KlaviyoList<KlaviyoAttributes>>("klaviyo", `https://a.klaviyo.com/api/${path}`, { headers: headers(apiKey) });
  return (response.data ?? []).slice(0, 3).map((item) => ({ id: item.id, name: item.attributes?.name ?? "Untitled", revenue: null }));
}

export async function fetchKlaviyoMetrics(apiKey: string, period: ReportPeriod): Promise<KlaviyoMetrics> {
  void period;
  const [flows, campaigns] = await Promise.all([listPerformers(apiKey, "flows/?page[size]=3"), listPerformers(apiKey, "campaigns/?page[size]=3")]);
  const unavailable = metric(null, null);
  return {
    currency: "USD",
    emailRevenue: unavailable, sent: unavailable, delivered: unavailable, opened: unavailable, clicked: unavailable,
    openRate: unavailable, clickRate: unavailable, conversionRate: unavailable,
    topFlows: flows, topCampaigns: campaigns, newSubscribers: unavailable, unsubscribes: unavailable,
    sms: { enabled: false, sent: unavailable, clicked: unavailable, revenue: unavailable },
  };
}
