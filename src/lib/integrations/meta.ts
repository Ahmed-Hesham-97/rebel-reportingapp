import "server-only";

import { requestJson } from "@/lib/integrations/http";
import { metric, type ReportPeriod } from "@/lib/reports/date-range";
import type { MetaMetrics } from "@/types/report";

type MetaInsight = { campaign_id?: string; campaign_name?: string; adset_id?: string; adset_name?: string; publisher_platform?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; cpm?: string; cpc?: string; purchase_roas?: Array<{ value?: string }>; actions?: Array<{ action_type?: string; value?: string }>; action_values?: Array<{ action_type?: string; value?: string }> };
type MetaResponse<T> = { data?: T[]; error?: { message?: string } };

const VERSION = "v21.0";

function accountPath(accountId: string) {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function timeRange(start: string, end: string) {
  return encodeURIComponent(JSON.stringify({ since: start.slice(0, 10), until: end.slice(0, 10) }));
}

export async function testMetaConnection(accessToken: string, adAccountId: string) {
  const response = await requestJson<{ name?: string; account_status?: number; error?: { message?: string } }>(`meta`, `https://graph.facebook.com/${VERSION}/${accountPath(adAccountId)}?fields=name,account_status&access_token=${encodeURIComponent(accessToken)}`);
  if (response.error) throw new Error(response.error.message ?? "Meta connection failed");
  return { name: response.name ?? "Meta ad account", status: response.account_status };
}

async function insights(accessToken: string, adAccountId: string, start: string, end: string, level = "account", breakdown?: string): Promise<MetaInsight[]> {
  const fields = "campaign_id,campaign_name,adset_id,adset_name,publisher_platform,spend,impressions,clicks,ctr,cpm,cpc,purchase_roas,actions,action_values";
  const breakdownParam = breakdown ? `&breakdowns=${breakdown}` : "";
  const response = await requestJson<MetaResponse<MetaInsight>>(`meta`, `https://graph.facebook.com/${VERSION}/${accountPath(adAccountId)}/insights?level=${level}&fields=${fields}&time_range=${timeRange(start, end)}${breakdownParam}&access_token=${encodeURIComponent(accessToken)}`);
  if (response.error) throw new Error(response.error.message ?? "Meta insights failed");
  return response.data ?? [];
}

function action(insight: MetaInsight, type: string, values = false) {
  const source = values ? insight.action_values : insight.actions;
  return Number(source?.find((item) => item.action_type === type)?.value ?? 0);
}

function normalize(insight: MetaInsight) {
  const purchaseValue = action(insight, "purchase", true);
  const purchases = action(insight, "purchase");
  return {
    spend: Number(insight.spend ?? 0), roas: Number(insight.purchase_roas?.[0]?.value ?? 0),
    cpm: Number(insight.cpm ?? 0), cpc: Number(insight.cpc ?? 0), ctr: Number(insight.ctr ?? 0),
    purchases, purchaseValue,
  };
}

export async function fetchMetaMetrics(accessToken: string, adAccountId: string, period: ReportPeriod): Promise<MetaMetrics> {
  const [current, previous, platforms, campaigns, adSets] = await Promise.all([
    insights(accessToken, adAccountId, period.current.start, period.current.end),
    insights(accessToken, adAccountId, period.previous.start, period.previous.end),
    insights(accessToken, adAccountId, period.current.start, period.current.end, "account", "publisher_platform"),
    insights(accessToken, adAccountId, period.current.start, period.current.end, "campaign"),
    insights(accessToken, adAccountId, period.current.start, period.current.end, "adset"),
  ]);
  const currentValues = normalize(current[0] ?? {});
  const previousValues = normalize(previous[0] ?? {});
  return {
    currency: "USD",
    spend: metric(currentValues.spend, previousValues.spend), roas: metric(currentValues.roas, previousValues.roas),
    cpm: metric(currentValues.cpm, previousValues.cpm), cpc: metric(currentValues.cpc, previousValues.cpc), ctr: metric(currentValues.ctr, previousValues.ctr),
    purchases: metric(currentValues.purchases, previousValues.purchases), purchaseValue: metric(currentValues.purchaseValue, previousValues.purchaseValue),
    topCampaigns: campaigns.map((item) => ({ id: item.campaign_id ?? "unknown", name: item.campaign_name ?? "Untitled campaign", revenue: action(item, "purchase", true), roas: Number(item.purchase_roas?.[0]?.value ?? 0), conversions: action(item, "purchase") })).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)).slice(0, 3),
    topAdSets: adSets.map((item) => ({ id: item.adset_id ?? "unknown", name: item.adset_name ?? "Untitled ad set", revenue: action(item, "purchase", true), conversions: action(item, "purchase") })).sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0)).slice(0, 3),
    byPlatform: platforms.map((item) => ({ platform: item.publisher_platform === "instagram" ? "instagram" as const : "facebook" as const, spend: Number(item.spend ?? 0), purchases: action(item, "purchase"), purchaseValue: action(item, "purchase", true) })),
  };
}
