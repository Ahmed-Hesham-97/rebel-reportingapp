/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { normalizeSections, type ReportSectionId } from "@/lib/reports/sections";
import type { DeltaMetric, ReportSnapshot } from "@/types/report";

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#0f172a" },
  cover: { justifyContent: "center", backgroundColor: "#0f172a", color: "#fff" },
  eyebrow: { color: "#ef4444", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 18 },
  title: { fontSize: 30, fontWeight: 700, marginBottom: 10 },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 18 },
  subheading: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  muted: { color: "#64748b", fontSize: 10 },
  grid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  tile: { flex: 1, padding: 12, backgroundColor: "#f8fafc", borderRadius: 6 },
  label: { fontSize: 9, color: "#64748b", marginBottom: 6 },
  value: { fontSize: 18, fontWeight: 700 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", fontSize: 10 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, fontSize: 8, color: "#64748b" },
});

function value(metric?: DeltaMetric) {
  return metric?.current === null || metric?.current === undefined ? "—" : metric.current.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function changeLabel(metric?: DeltaMetric) {
  return typeof metric?.changePct === "number" ? `${metric.changePct.toFixed(1)}%` : "—";
}

function currencyValue(value: number | null | undefined, currency: string) {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US", { style: "currency", currency });
}

function MetricTile({ label, metric }: { label: string; metric?: DeltaMetric }) {
  return <View style={styles.tile}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value(metric)}</Text><Text style={styles.muted}>{typeof metric?.changePct === "number" ? `${metric.changePct >= 0 ? "+" : ""}${metric.changePct.toFixed(1)}% MoM` : "No comparison"}</Text></View>;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function PercentTile({ label, metric }: { label: string; metric?: DeltaMetric }) {
  return <View style={styles.tile}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{percent(metric?.current)}</Text><Text style={styles.muted}>{typeof metric?.changePct === "number" ? `${metric.changePct >= 0 ? "+" : ""}${metric.changePct.toFixed(1)}% MoM` : "No comparison"}</Text></View>;
}

function Footer() {
  return <Text style={styles.footer}>Confidential — Rebel Marketing</Text>;
}

function SourceUnavailable({ note }: { note: string }) {
  return <Text style={{ fontSize: 10, color: "#64748b", lineHeight: 1.5 }}>{note}</Text>;
}

export function ReportDocument({ snapshot, clientName, logoUrl }: { snapshot: ReportSnapshot; clientName: string; logoUrl?: string | null }) {
  const shopify = snapshot.shopify.data;
  const klaviyo = snapshot.klaviyo.data;
  const meta = snapshot.meta.data;
  const funnel = shopify?.funnel ?? null;
  const storeChanges = shopify?.storeChanges ?? [];
  const sections = normalizeSections(snapshot.includedSections);
  const includes = (id: ReportSectionId) => sections.includes(id);
  return <Document title={`${clientName} monthly report`} author="Rebel Marketing">
    <Page size="A4" style={[styles.page, styles.cover]}>{logoUrl && <Image src={logoUrl} style={{ width: 110, marginBottom: 30 }} />}<Text style={styles.eyebrow}>Rebel Marketing</Text><Text style={styles.title}>{clientName}</Text><Text style={{ fontSize: 16 }}>Performance report</Text><Text style={{ marginTop: 18, color: "#cbd5e1" }}>{snapshot.reportMonth}</Text><Text style={{ position: "absolute", bottom: 42, fontSize: 10, color: "#cbd5e1" }}>Prepared by Rebel Marketing</Text></Page>
    {includes("executive-summary") && <Page size="A4" style={styles.page}><Text style={styles.eyebrow}>Executive summary</Text><Text style={styles.heading}>What changed this month</Text>{snapshot.executiveSummary.map((item) => <View key={item} style={{ marginBottom: 14, padding: 14, backgroundColor: "#f8fafc", borderRadius: 6 }}><Text style={{ fontSize: 11, lineHeight: 1.5 }}>{item}</Text></View>)}<Footer /></Page>}
    {includes("shopify") && <Page size="A4" style={styles.page}><Text style={styles.eyebrow}>Shopify</Text><Text style={styles.heading}>Store performance</Text><View style={styles.grid}><MetricTile label="Revenue" metric={shopify?.revenue} /><MetricTile label="Orders" metric={shopify?.orders} /><MetricTile label="Average order value" metric={shopify?.aov} /></View><Text style={styles.subheading}>Top products</Text>{shopify?.topProducts?.map((product) => <View style={styles.row} key={product.id}><Text>{product.title}</Text><Text>{product.revenue.toLocaleString("en-US", { style: "currency", currency: shopify?.currency ?? "USD" })}</Text></View>)}<Footer /></Page>}
    {includes("storefront-funnel") && <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>Storefront</Text>
      <Text style={styles.heading}>Traffic &amp; conversion funnel</Text>
      {funnel ? <>
        <View style={styles.grid}><MetricTile label="Sessions" metric={funnel.sessions} /><PercentTile label="Added to cart rate" metric={funnel.addedToCartRate} /><PercentTile label="Conversion rate" metric={funnel.conversionRate} /></View>
        <View style={styles.grid}><MetricTile label="Visitors" metric={funnel.onlineStoreVisitors} /><PercentTile label="Checkout conversion" metric={funnel.checkoutConversionRate} /><PercentTile label="Bounce rate" metric={funnel.bounceRate} /></View>
        <Text style={styles.subheading}>Sessions by traffic source</Text>
        {funnel.byReferrerSource.map((slice) => <View style={styles.row} key={`source-${slice.label}`}><Text>{slice.label}</Text><Text>{slice.sessions.toLocaleString("en-US")} sessions · {percent(slice.conversionRate)} CVR</Text></View>)}
        <Text style={[styles.subheading, { marginTop: 16 }]}>Sessions by device</Text>
        {funnel.byDeviceType.map((slice) => <View style={styles.row} key={`device-${slice.label}`}><Text>{slice.label}</Text><Text>{slice.sessions.toLocaleString("en-US")} sessions · {percent(slice.conversionRate)} CVR</Text></View>)}
      </> : <SourceUnavailable note="Storefront analytics were not available for this period. Grant the read_reports scope to the store's private app to include sessions, add-to-cart rate, and checkout conversion." />}
      <Footer />
    </Page>}
    {includes("klaviyo") && <Page size="A4" style={styles.page}><Text style={styles.eyebrow}>Klaviyo</Text><Text style={styles.heading}>Email &amp; SMS performance</Text><View style={styles.grid}><MetricTile label="Email revenue" metric={klaviyo?.emailRevenue} /><MetricTile label="Open rate" metric={klaviyo?.openRate} /><MetricTile label="Click rate" metric={klaviyo?.clickRate} /></View><Text style={styles.subheading}>Top flows</Text>{klaviyo?.topFlows?.map((flow) => <View style={styles.row} key={flow.id}><Text>{flow.name}</Text><Text>{currencyValue(flow.revenue, klaviyo?.currency ?? "USD")}</Text></View>)}<Footer /></Page>}
    {includes("meta") && <Page size="A4" style={styles.page}><Text style={styles.eyebrow}>Meta Ads</Text><Text style={styles.heading}>Paid ads performance</Text><View style={styles.grid}><MetricTile label="Ad spend" metric={meta?.spend} /><MetricTile label="ROAS" metric={meta?.roas} /><MetricTile label="Purchases" metric={meta?.purchases} /></View><Text style={styles.subheading}>Top campaigns</Text>{meta?.topCampaigns?.map((campaign) => <View style={styles.row} key={campaign.id}><Text>{campaign.name}</Text><Text>{campaign.roas?.toFixed(2) ?? "—"} ROAS</Text></View>)}<Footer /></Page>}
    {includes("comparison") && <Page size="A4" style={styles.page}><Text style={styles.eyebrow}>Comparison</Text><Text style={styles.heading}>Month-over-month comparison</Text>{[["Shopify revenue", shopify?.revenue], ["Orders", shopify?.orders], ["Email revenue", klaviyo?.emailRevenue], ["Ad spend", meta?.spend], ["ROAS", meta?.roas]].map(([label, metric]) => <View style={styles.row} key={String(label)}><Text>{String(label)}</Text><Text>{value(metric as DeltaMetric)} · {changeLabel(metric as DeltaMetric | undefined)}</Text></View>)}<Footer /></Page>}
    {includes("store-changes") && <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>Store changes</Text>
      <Text style={styles.heading}>What we shipped this month</Text>
      <Text style={styles.subheading}>Live theme</Text>
      {shopify?.theme
        ? <View style={styles.row}><Text>{shopify.theme.name}</Text><Text>Last updated {shopify.theme.updatedAt.slice(0, 10)}</Text></View>
        : <SourceUnavailable note="Theme details were not available. Grant the read_themes scope to include the live theme and its last update date." />}
      <Text style={[styles.subheading, { marginTop: 16 }]}>Catalog &amp; content updates</Text>
      {storeChanges.length
        ? storeChanges.slice(0, 25).map((change) => <View style={styles.row} key={change.id}><Text style={{ flex: 1, paddingRight: 10 }}>{change.message || `${change.subject} ${change.action}`}</Text><Text>{change.occurredAt.slice(0, 10)}</Text></View>)
        : <SourceUnavailable note="No product, collection, or content changes were recorded for this period." />}
      <Footer />
    </Page>}
  </Document>;
}
