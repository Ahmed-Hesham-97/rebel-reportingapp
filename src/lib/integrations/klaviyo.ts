import "server-only";

import { IntegrationError } from "@/lib/integrations/retry";
import { requestJson } from "@/lib/integrations/http";
import { metric, type ReportPeriod } from "@/lib/reports/date-range";
import type { CampaignPerformance, KlaviyoActivity, KlaviyoMetrics } from "@/types/report";

type KlaviyoList<T> = { data?: Array<{ id: string; attributes?: T }>; errors?: Array<{ detail?: string }> };
type KlaviyoAttributes = { name?: string; status?: string };
type ReportStats = Record<string, number | undefined>;
type ValuesResult = { groupings?: Record<string, string | undefined>; statistics?: ReportStats };
type ValuesResponse = { data?: { attributes?: { results?: ValuesResult[] } }; errors?: Array<{ detail?: string }> };

/** Keep on a widely-supported revision; channel filter is still required for campaigns. */
const REVISION = "2024-10-15";
const CAMPAIGN_STATS = [
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "open_rate",
  "click_rate",
  "conversion_rate",
  "conversion_value",
  "conversions",
  "unsubscribes",
  "unsubscribe_rate",
] as const;
const FLOW_STATS = [
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "conversion_value",
  "conversions",
  "open_rate",
  "click_rate",
  "conversion_rate",
] as const;

function headers(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey.trim()}`,
    revision: REVISION,
    Accept: "application/json",
    "Content-Type": "application/json",
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

/** Klaviyo custom timeframes are inclusive; our period.end is exclusive (start of next month). */
function timeframe(startIso: string, endExclusiveIso: string) {
  const endInclusive = new Date(new Date(endExclusiveIso).getTime() - 1000);
  return {
    start: new Date(startIso).toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    end: endInclusive.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
  };
}

function asRatePercent(value: number | null) {
  if (value === null) return null;
  // Reporting API rates are fractional [0, 1].
  return value <= 1 ? value * 100 : value;
}

function sumStat(results: ValuesResult[], key: string) {
  return results.reduce((total, item) => total + Number(item.statistics?.[key] ?? 0), 0);
}

function weightedRate(results: ValuesResult[], rateKey: string, weightKey: string) {
  let weighted = 0;
  let weight = 0;
  for (const item of results) {
    const w = Number(item.statistics?.[weightKey] ?? 0);
    const rate = Number(item.statistics?.[rateKey] ?? 0);
    if (w <= 0) continue;
    weighted += rate * w;
    weight += w;
  }
  return weight > 0 ? weighted / weight : null;
}

function aggregate(results: ValuesResult[]) {
  const delivered = sumStat(results, "delivered");
  const recipients = sumStat(results, "recipients");
  const opens = sumStat(results, "opens_unique");
  const clicks = sumStat(results, "clicks_unique");
  const conversions = sumStat(results, "conversions");
  const revenue = sumStat(results, "conversion_value");
  const unsubscribes = sumStat(results, "unsubscribes");
  const openRate = delivered > 0 ? opens / delivered : weightedRate(results, "open_rate", "delivered");
  const clickRate = delivered > 0 ? clicks / delivered : weightedRate(results, "click_rate", "delivered");
  const conversionRate = delivered > 0 ? conversions / delivered : weightedRate(results, "conversion_rate", "delivered");
  const unsubscribeRate = recipients > 0 ? unsubscribes / recipients : weightedRate(results, "unsubscribe_rate", "recipients");
  return {
    recipients,
    delivered,
    opens,
    clicks,
    conversions,
    revenue,
    unsubscribes,
    openRate,
    clickRate,
    conversionRate,
    unsubscribeRate,
  };
}

async function findConversionMetricId(apiKey: string) {
  // Metrics list supports page[cursor] only — never send page[size] (400: page_size invalid field).
  const response = await requestJson<KlaviyoList<{ name?: string }>>("klaviyo", klaviyoUrl("metrics/"), {
    headers: headers(apiKey),
  });
  const metrics = response.data ?? [];
  const preferred =
    metrics.find((item) => /placed order/i.test(item.attributes?.name ?? "")) ??
    metrics.find((item) => /order/i.test(item.attributes?.name ?? "")) ??
    metrics[0];
  if (!preferred?.id) throw new Error("Klaviyo conversion metric (Placed Order) was not found. Ensure the key has metrics:read.");
  return preferred.id;
}

async function queryValues(
  apiKey: string,
  path: "campaign-values-reports/" | "flow-values-reports/",
  type: "campaign-values-report" | "flow-values-report",
  conversionMetricId: string,
  start: string,
  end: string,
  statistics: readonly string[],
  groupBy: string[],
  filter?: string,
) {
  const response = await requestJson<ValuesResponse>("klaviyo", klaviyoUrl(path), {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      data: {
        type,
        attributes: {
          statistics,
          timeframe: timeframe(start, end),
          conversion_metric_id: conversionMetricId,
          group_by: groupBy,
          ...(filter ? { filter } : {}),
        },
      },
    }),
  });
  if (response.errors?.length) throw new Error(response.errors[0].detail ?? `Klaviyo ${path} failed`);
  return response.data?.attributes?.results ?? [];
}

async function listFlows(apiKey: string) {
  // Avoid page[size] here — some account revisions reject size pagination on list endpoints.
  const response = await requestJson<KlaviyoList<KlaviyoAttributes>>(
    "klaviyo",
    klaviyoUrl("flows/", { "fields[flow]": "name,status" }),
    { headers: headers(apiKey) },
  );
  return response.data ?? [];
}

function topFlowsFromResults(results: ValuesResult[], flowNames: Map<string, string>): CampaignPerformance[] {
  const byFlow = new Map<string, { revenue: number; conversions: number; name?: string }>();
  for (const item of results) {
    const id = item.groupings?.flow_id;
    if (!id) continue;
    const current = byFlow.get(id) ?? { revenue: 0, conversions: 0, name: item.groupings?.flow_name };
    current.revenue += Number(item.statistics?.conversion_value ?? 0);
    current.conversions += Number(item.statistics?.conversions ?? 0);
    byFlow.set(id, current);
  }
  return [...byFlow.entries()]
    .map(([id, stats]) => ({
      id,
      name: flowNames.get(id) ?? stats.name ?? "Untitled flow",
      revenue: stats.revenue,
      conversions: stats.conversions,
    }))
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 3);
}

function topCampaignsFromResults(results: ValuesResult[]): CampaignPerformance[] {
  const byCampaign = new Map<string, { name: string; revenue: number; conversions: number }>();
  for (const item of results) {
    const id = item.groupings?.campaign_id;
    if (!id) continue;
    const current = byCampaign.get(id) ?? {
      name: item.groupings?.campaign_message_name ?? "Untitled campaign",
      revenue: 0,
      conversions: 0,
    };
    current.revenue += Number(item.statistics?.conversion_value ?? 0);
    current.conversions += Number(item.statistics?.conversions ?? 0);
    byCampaign.set(id, current);
  }
  return [...byCampaign.entries()]
    .map(([id, stats]) => ({ id, name: stats.name, revenue: stats.revenue, conversions: stats.conversions }))
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 3);
}

function emptyActivity(): KlaviyoActivity {
  return {
    campaignsSent: null,
    flowsSummary: null,
    listGrowthActivity: null,
    abTestsRun: null,
    highlights: null,
  };
}

export async function fetchKlaviyoMetrics(apiKey: string, period: ReportPeriod): Promise<KlaviyoMetrics> {
  const key = apiKey.trim();
  // Prove the key works before heavy reporting calls.
  await testKlaviyoConnection(key);

  const conversionMetricId = await findConversionMetricId(key);
  const campaignGroupBy = ["campaign_id", "campaign_message_id", "campaign_message_name", "send_channel"];
  const flowGroupBy = ["flow_id", "flow_message_id", "flow_name", "send_channel"];

  const [
    campaignCurrentResult,
    campaignPreviousResult,
    flowCurrentResult,
    flowPreviousResult,
    smsCurrentResult,
    smsPreviousResult,
    flowsResult,
  ] = await Promise.allSettled([
    queryValues(key, "campaign-values-reports/", "campaign-values-report", conversionMetricId, period.current.start, period.current.end, CAMPAIGN_STATS, campaignGroupBy),
    queryValues(key, "campaign-values-reports/", "campaign-values-report", conversionMetricId, period.previous.start, period.previous.end, CAMPAIGN_STATS, campaignGroupBy),
    queryValues(key, "flow-values-reports/", "flow-values-report", conversionMetricId, period.current.start, period.current.end, FLOW_STATS, flowGroupBy),
    queryValues(key, "flow-values-reports/", "flow-values-report", conversionMetricId, period.previous.start, period.previous.end, FLOW_STATS, flowGroupBy),
    queryValues(key, "campaign-values-reports/", "campaign-values-report", conversionMetricId, period.current.start, period.current.end, ["recipients", "clicks_unique", "conversion_value"], campaignGroupBy, 'equals(send_channel,"sms")'),
    queryValues(key, "campaign-values-reports/", "campaign-values-report", conversionMetricId, period.previous.start, period.previous.end, ["recipients", "clicks_unique", "conversion_value"], campaignGroupBy, 'equals(send_channel,"sms")'),
    listFlows(key),
  ]);

  const campaignCurrent = campaignCurrentResult.status === "fulfilled" ? campaignCurrentResult.value : [];
  const campaignPrevious = campaignPreviousResult.status === "fulfilled" ? campaignPreviousResult.value : [];
  const flowCurrent = flowCurrentResult.status === "fulfilled" ? flowCurrentResult.value : [];
  const flowPrevious = flowPreviousResult.status === "fulfilled" ? flowPreviousResult.value : [];
  const smsCurrent = smsCurrentResult.status === "fulfilled" ? smsCurrentResult.value : [];
  const smsPrevious = smsPreviousResult.status === "fulfilled" ? smsPreviousResult.value : [];
  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];

  const reportingFailed = [campaignCurrentResult, campaignPreviousResult, flowCurrentResult, flowPreviousResult].every((r) => r.status === "rejected");
  if (reportingFailed) {
    const reason = campaignCurrentResult.status === "rejected" ? campaignCurrentResult.reason : flowCurrentResult.status === "rejected" ? flowCurrentResult.reason : new Error("Klaviyo reporting failed");
    throw new IntegrationError(
      reason instanceof Error ? reason.message : "Klaviyo reporting failed",
      reason instanceof IntegrationError ? reason.status : 400,
    );
  }

  const currentCampaigns = aggregate(campaignCurrent);
  const previousCampaigns = aggregate(campaignPrevious);
  const currentFlows = aggregate(flowCurrent);
  const previousFlows = aggregate(flowPrevious);

  const currentSent = currentCampaigns.recipients + currentFlows.recipients;
  const previousSent = previousCampaigns.recipients + previousFlows.recipients;
  const currentDelivered = currentCampaigns.delivered + currentFlows.delivered;
  const previousDelivered = previousCampaigns.delivered + previousFlows.delivered;
  const currentOpened = currentCampaigns.opens + currentFlows.opens;
  const previousOpened = previousCampaigns.opens + previousFlows.opens;
  const currentClicked = currentCampaigns.clicks + currentFlows.clicks;
  const previousClicked = previousCampaigns.clicks + previousFlows.clicks;
  const currentRevenue = currentCampaigns.revenue + currentFlows.revenue;
  const previousRevenue = previousCampaigns.revenue + previousFlows.revenue;
  const currentConversions = currentCampaigns.conversions + currentFlows.conversions;
  const previousConversions = previousCampaigns.conversions + previousFlows.conversions;

  const currentOpenRate = currentDelivered > 0 ? currentOpened / currentDelivered : null;
  const previousOpenRate = previousDelivered > 0 ? previousOpened / previousDelivered : null;
  const currentClickRate = currentDelivered > 0 ? currentClicked / currentDelivered : null;
  const previousClickRate = previousDelivered > 0 ? previousClicked / previousDelivered : null;
  const currentConversionRate = currentDelivered > 0 ? currentConversions / currentDelivered : null;
  const previousConversionRate = previousDelivered > 0 ? previousConversions / previousDelivered : null;

  const flowNames = new Map(flows.map((flow) => [flow.id, flow.attributes?.name ?? "Untitled flow"]));
  const live = flows.filter((flow) => /live|manual/i.test(flow.attributes?.status ?? "")).length;
  const draft = flows.filter((flow) => /draft/i.test(flow.attributes?.status ?? "")).length;
  const uniqueCampaigns = new Set(campaignCurrent.map((item) => item.groupings?.campaign_id).filter(Boolean)).size;

  const smsNow = aggregate(smsCurrent);
  const smsPrev = aggregate(smsPrevious);
  const smsEnabled = smsNow.recipients > 0 || smsPrev.recipients > 0 || smsNow.revenue > 0;
  const hasEmailActivity = currentSent > 0 || previousSent > 0 || currentRevenue > 0 || previousRevenue > 0;

  const activity: KlaviyoActivity = {
    ...emptyActivity(),
    campaignsSent: uniqueCampaigns > 0 ? String(uniqueCampaigns) : null,
    flowsSummary: flows.length ? `${live} active / ${draft} built / ${Math.max(flows.length - live - draft, 0)} other` : null,
  };

  return {
    currency: "USD",
    emailRevenue: metric(currentRevenue, previousRevenue),
    sent: metric(hasEmailActivity ? currentSent : null, hasEmailActivity ? previousSent : null),
    delivered: metric(hasEmailActivity ? currentDelivered : null, hasEmailActivity ? previousDelivered : null),
    opened: metric(hasEmailActivity ? currentOpened : null, hasEmailActivity ? previousOpened : null),
    clicked: metric(hasEmailActivity ? currentClicked : null, hasEmailActivity ? previousClicked : null),
    openRate: metric(asRatePercent(currentOpenRate), asRatePercent(previousOpenRate)),
    clickRate: metric(asRatePercent(currentClickRate), asRatePercent(previousClickRate)),
    conversionRate: metric(asRatePercent(currentConversionRate), asRatePercent(previousConversionRate)),
    topFlows: topFlowsFromResults(flowCurrent, flowNames),
    topCampaigns: topCampaignsFromResults(campaignCurrent),
    newSubscribers: metric(null, null),
    unsubscribes: metric(currentCampaigns.unsubscribes, previousCampaigns.unsubscribes),
    unsubscribeRate: metric(asRatePercent(currentCampaigns.unsubscribeRate), asRatePercent(previousCampaigns.unsubscribeRate)),
    campaignRevenue: metric(currentCampaigns.revenue, previousCampaigns.revenue),
    listGrowth: metric(null, null),
    activity,
    sms: {
      enabled: smsEnabled,
      sent: metric(smsEnabled ? smsNow.recipients : null, smsEnabled ? smsPrev.recipients : null),
      clicked: metric(smsEnabled ? smsNow.clicks : null, smsEnabled ? smsPrev.clicks : null),
      revenue: metric(smsEnabled ? smsNow.revenue : null, smsEnabled ? smsPrev.revenue : null),
    },
  };
}
