import type { ReportSnapshot } from "@/types/report";
import { formatPercent } from "@/lib/utils";

export function buildExecutiveSummary(snapshot: Pick<ReportSnapshot, "shopify" | "klaviyo" | "meta">) {
  const candidates = [
    ["Shopify revenue", snapshot.shopify.data?.revenue?.changePct ?? null],
    ["Meta Ads ROAS", snapshot.meta.data?.roas?.changePct ?? null],
    ["Klaviyo email revenue", snapshot.klaviyo.data?.emailRevenue?.changePct ?? null],
  ].filter((item): item is [string, number] => typeof item[1] === "number");
  if (!candidates.length) return ["Connect data sources to generate executive highlights."];
  const biggestWin = [...candidates].sort((a, b) => b[1] - a[1])[0];
  const biggestConcern = [...candidates].sort((a, b) => a[1] - b[1])[0];
  const funnel = snapshot.shopify.data?.funnel ?? null;
  return [
    `${biggestWin[0]} was the biggest positive movement at ${formatPercent(biggestWin[1])} month over month.`,
    biggestConcern[1] < 0 ? `${biggestConcern[0]} needs attention, down ${Math.abs(biggestConcern[1]).toFixed(1)}% month over month.` : `All tracked headline metrics moved positively month over month.`,
    ...(funnel && typeof funnel.sessions.current === "number"
      ? [`The storefront drew ${funnel.sessions.current.toLocaleString("en-US")} sessions, converting at ${funnel.conversionRate.current?.toFixed(1) ?? "—"}% with a ${funnel.addedToCartRate.current?.toFixed(1) ?? "—"}% add-to-cart rate.`]
      : []),
    ...(["Shopify", "Klaviyo", "Meta Ads"] as const).filter((sourceName, index) => [snapshot.shopify, snapshot.klaviyo, snapshot.meta][index].status !== "success").map((sourceName) => `${sourceName} data was unavailable for this report.`),
  ];
}
