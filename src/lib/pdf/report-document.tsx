/* eslint-disable jsx-a11y/alt-text */
import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { registerReportFonts } from "@/lib/pdf/fonts";
import { normalizeSections, type ReportSectionId } from "@/lib/reports/sections";
import { asPercentPoints } from "@/lib/utils";
import type { DeltaMetric, ManualReportData, ReportSnapshot } from "@/types/report";

registerReportFonts();

const brand = "#e11d48";
const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const wash = "#f8fafc";

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 52, paddingHorizontal: 42, fontFamily: "DMSans", color: ink, fontSize: 10 },
  cover: { justifyContent: "center", backgroundColor: ink, color: "#fff", padding: 48 },
  brandMark: { color: brand, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 28, fontFamily: "Syne", fontWeight: 700 },
  coverTitle: { fontSize: 30, fontFamily: "Syne", fontWeight: 800, marginBottom: 8 },
  coverMeta: { marginTop: 28, fontSize: 11, color: "#cbd5e1", lineHeight: 1.7 },
  sectionEyebrow: { color: brand, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontFamily: "Syne", fontWeight: 700 },
  heading: { fontSize: 22, fontFamily: "Syne", fontWeight: 700, marginBottom: 14 },
  subheading: { fontSize: 11, fontFamily: "Syne", fontWeight: 700, marginTop: 14, marginBottom: 8, color: ink },
  muted: { color: muted, fontSize: 9 },
  body: { fontSize: 10, lineHeight: 1.5, color: ink },
  activityRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: line },
  activityLabel: { width: "42%", color: muted, fontSize: 9 },
  activityValue: { width: "58%", fontSize: 9 },
  tableHeader: { flexDirection: "row", backgroundColor: wash, paddingVertical: 7, paddingHorizontal: 8, marginTop: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: line },
  colMetric: { width: "40%", fontSize: 9 },
  colPrev: { width: "20%", fontSize: 9, textAlign: "right" },
  colCurrent: { width: "20%", fontSize: 9, textAlign: "right", fontFamily: "DMSans", fontWeight: 700 },
  colChange: { width: "20%", fontSize: 9, textAlign: "right" },
  noteBox: { marginTop: 10, padding: 12, backgroundColor: wash },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, fontSize: 8, color: muted, flexDirection: "row", justifyContent: "space-between" },
  nextMonth: { marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: line },
});

function fmt(value: number | null | undefined, opts?: { currency?: string; percent?: boolean; digits?: number }) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (opts?.currency) return value.toLocaleString("en-US", { style: "currency", currency: opts.currency, maximumFractionDigits: opts.digits ?? 0 });
  if (opts?.percent) return `${asPercentPoints(value).toFixed(opts.digits ?? 1)}%`;
  return value.toLocaleString("en-US", { maximumFractionDigits: opts?.digits ?? 2 });
}

function changePct(metric?: DeltaMetric | null) {
  return typeof metric?.changePct === "number" ? `${metric.changePct >= 0 ? "+" : ""}${metric.changePct.toFixed(1)}%` : "—";
}

function manualChange(current: string, previous: string) {
  const cur = Number(String(current).replace(/[^0-9.-]/g, ""));
  const prev = Number(String(previous).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return "—";
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function display(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function Footer({ clientName }: { clientName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Confidential — Rebel Marketing · {clientName}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ActivityLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityLabel}>{label}</Text>
      <Text style={styles.activityValue}>{display(value)}</Text>
    </View>
  );
}

function MetricTable({
  rows,
}: {
  rows: Array<{ label: string; previous: string; current: string; change: string }>;
}) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.colMetric, { fontFamily: "Syne", fontWeight: 700 }]}>Metric</Text>
        <Text style={[styles.colPrev, { fontFamily: "Syne", fontWeight: 700 }]}>Prev.</Text>
        <Text style={[styles.colCurrent, { fontFamily: "Syne", fontWeight: 700 }]}>Current</Text>
        <Text style={[styles.colChange, { fontFamily: "Syne", fontWeight: 700 }]}>% Change</Text>
      </View>
      {rows.map((row) => (
        <View style={styles.tableRow} key={row.label}>
          <Text style={styles.colMetric}>{row.label}</Text>
          <Text style={styles.colPrev}>{row.previous}</Text>
          <Text style={styles.colCurrent}>{row.current}</Text>
          <Text style={styles.colChange}>{row.change}</Text>
        </View>
      ))}
    </View>
  );
}

function deltaRows(
  items: Array<{ label: string; metric?: DeltaMetric | null; currency?: string; percent?: boolean; digits?: number }>,
) {
  return items.map((item) => ({
    label: item.label,
    previous: fmt(item.metric?.previous, { currency: item.currency, percent: item.percent, digits: item.digits }),
    current: fmt(item.metric?.current, { currency: item.currency, percent: item.percent, digits: item.digits }),
    change: changePct(item.metric),
  }));
}

function manualRows(
  items: Array<{ label: string; current: string; previous: string }>,
) {
  return items.map((item) => ({
    label: item.label,
    previous: display(item.previous),
    current: display(item.current),
    change: manualChange(item.current, item.previous),
  }));
}

function NextMonth({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <View style={styles.nextMonth}>
      <Text style={styles.subheading}>Next month →</Text>
      <Text style={styles.body}>{value.trim()}</Text>
    </View>
  );
}

function SectionPage({
  eyebrow,
  title,
  clientName,
  children,
}: {
  eyebrow: string;
  title: string;
  clientName: string;
  children: ReactNode;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.heading}>{title}</Text>
      {children}
      <Footer clientName={clientName} />
    </Page>
  );
}

export function ReportDocument({
  snapshot,
  clientName,
  logoUrl,
}: {
  snapshot: ReportSnapshot;
  clientName: string;
  logoUrl?: string | null;
}) {
  const shopify = snapshot.shopify.data;
  const klaviyo = snapshot.klaviyo.data;
  const meta = snapshot.meta.data;
  const manual: ManualReportData = snapshot.manual;
  const funnel = shopify?.funnel ?? null;
  const currency = shopify?.currency ?? meta?.currency ?? "USD";
  const sections = normalizeSections(snapshot.includedSections);
  const includes = (id: ReportSectionId) => sections.includes(id);
  const periodLabel = snapshot.reportMonth;

  return (
    <Document title={`${clientName} monthly report`} author="Rebel Marketing">
      <Page size="A4" style={styles.cover}>
        {logoUrl ? <Image src={logoUrl} style={{ width: 110, marginBottom: 28 }} /> : null}
        <Text style={styles.brandMark}>Rebel ● Marketing</Text>
        <Text style={styles.coverTitle}>Monthly Performance Report</Text>
        <View style={styles.coverMeta}>
          <Text>Client · {clientName}</Text>
          <Text>Period · {periodLabel}</Text>
          <Text>Prepared by · Rebel Marketing</Text>
        </View>
        <Text style={{ position: "absolute", bottom: 48, left: 48, right: 48, fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
          Below is a full breakdown of activity and performance across all channels for the reporting period.
        </Text>
      </Page>

      {includes("social-media") && (
        <SectionPage eyebrow="01 · Social Media" title="Organic social" clientName={clientName}>
          <Text style={styles.subheading}>Activity</Text>
          <ActivityLine label="Platforms active" value={manual.social.platformsActive} />
          <ActivityLine label="Feed posts published" value={manual.social.feedPosts} />
          <ActivityLine label="Reels / short-form videos" value={manual.social.reels} />
          <ActivityLine label="Stories published" value={manual.social.stories} />
          <ActivityLine label="Community management (DMs / comments)" value={manual.social.communityManagement} />
          <ActivityLine label="Top performing content" value={manual.social.topContent} />
          {manual.social.topContentImage.trim().startsWith("http") ? (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Image src={manual.social.topContentImage.trim()} style={{ width: 280, maxHeight: 360 }} />
            </View>
          ) : null}
          <ActivityLine label="Highlights & wins" value={manual.social.highlights} />
          <Text style={styles.subheading}>Performance</Text>
          <MetricTable
            rows={manualRows([
              { label: "Reach", current: manual.social.reach, previous: manual.social.reachPrev },
              { label: "Impressions", current: manual.social.impressions, previous: manual.social.impressionsPrev },
              { label: "Engagement rate", current: manual.social.engagementRate, previous: manual.social.engagementRatePrev },
              { label: "Follower growth", current: manual.social.followerGrowth, previous: manual.social.followerGrowthPrev },
              { label: "Profile visits", current: manual.social.profileVisits, previous: manual.social.profileVisitsPrev },
              { label: "Link clicks", current: manual.social.linkClicks, previous: manual.social.linkClicksPrev },
              { label: "Saves & shares", current: manual.social.savesShares, previous: manual.social.savesSharesPrev },
            ])}
          />
          <NextMonth value={manual.social.nextMonth} />
        </SectionPage>
      )}

      {includes("paid-media") && (
        <SectionPage eyebrow="02 · Paid Media" title="Paid media performance" clientName={clientName}>
          {manual.paid.metaNotes.trim() ? (
            <View style={styles.noteBox}>
              <Text style={styles.body}>{manual.paid.metaNotes.trim()}</Text>
            </View>
          ) : null}
          <Text style={styles.subheading}>Meta performance</Text>
          {meta ? (
            <MetricTable
              rows={deltaRows([
                { label: "Ad spend", metric: meta.spend, currency },
                { label: "Purchases", metric: meta.purchases },
                { label: "Conversion value", metric: meta.purchaseValue, currency },
                { label: "ROAS", metric: meta.roas, digits: 2 },
                { label: "Conversion rate", metric: meta.conversionRate, percent: true },
              ])}
            />
          ) : (
            <Text style={styles.muted}>Meta Ads not connected for this client. Connect in settings to auto-fill this table.</Text>
          )}
          {meta?.topCampaigns?.length ? (
            <>
              <Text style={styles.subheading}>Top Meta campaigns</Text>
              {meta.topCampaigns.map((campaign) => (
                <View style={styles.activityRow} key={campaign.id}>
                  <Text style={styles.activityLabel}>{campaign.name}</Text>
                  <Text style={styles.activityValue}>{campaign.roas?.toFixed(2) ?? "—"} ROAS</Text>
                </View>
              ))}
            </>
          ) : null}
          <Text style={styles.subheading}>Google Ads performance</Text>
          <MetricTable
            rows={manualRows([
              { label: "Ad spend", current: manual.paid.googleSpend, previous: manual.paid.googleSpendPrev },
              { label: "Purchases", current: manual.paid.googlePurchases, previous: manual.paid.googlePurchasesPrev },
              { label: "Conversion value", current: manual.paid.googleConversionValue, previous: manual.paid.googleConversionValuePrev },
              { label: "ROAS", current: manual.paid.googleRoas, previous: manual.paid.googleRoasPrev },
              { label: "Conversion rate", current: manual.paid.googleConversionRate, previous: manual.paid.googleConversionRatePrev },
            ])}
          />
          {manual.paid.googleNotes.trim() ? (
            <View style={styles.noteBox}>
              <Text style={styles.body}>{manual.paid.googleNotes.trim()}</Text>
            </View>
          ) : null}
        </SectionPage>
      )}

      {includes("website") && (
        <SectionPage eyebrow="03 · Website" title="Development & performance" clientName={clientName}>
          <Text style={styles.subheading}>Development & optimization</Text>
          <ActivityLine label="Homepage / banner updates" value={manual.website.homepageUpdates} />
          <ActivityLine label="New pages built" value={manual.website.newPages} />
          <ActivityLine label="Product page updates" value={manual.website.productPageUpdates} />
          <ActivityLine label="Speed & performance" value={manual.website.speedPerformance} />
          <ActivityLine label="Bug fixes / technical" value={manual.website.bugFixes} />
          <ActivityLine label="CRO changes tested" value={manual.website.croChanges} />
          {shopify?.theme ? (
            <ActivityLine label="Live theme" value={`${shopify.theme.name} (updated ${shopify.theme.updatedAt.slice(0, 10)})`} />
          ) : null}
          <Text style={styles.subheading}>Performance</Text>
          <MetricTable
            rows={deltaRows([
              { label: "Sessions", metric: funnel?.sessions },
              { label: "Users", metric: funnel?.onlineStoreVisitors },
              { label: "Conversion rate", metric: funnel?.conversionRate ?? shopify?.conversionRate, percent: true },
              { label: "Avg. order value", metric: shopify?.aov, currency },
              { label: "Bounce rate", metric: funnel?.bounceRate, percent: true },
              { label: "Revenue", metric: shopify?.revenue, currency },
              { label: "Orders", metric: shopify?.orders },
              { label: "New customers", metric: shopify?.newCustomers },
              { label: "Returning customers", metric: shopify?.returningCustomers },
              { label: "Refund rate", metric: shopify?.refundRate, percent: true },
            ])}
          />
          {shopify?.topProducts?.length ? (
            <>
              <Text style={styles.subheading}>Top products</Text>
              {shopify.topProducts.map((product) => (
                <View style={styles.activityRow} key={product.id}>
                  <Text style={styles.activityLabel}>{product.title}</Text>
                  <Text style={styles.activityValue}>{fmt(product.revenue, { currency })}</Text>
                </View>
              ))}
            </>
          ) : null}
          {shopify?.storeChanges?.length ? (
            <>
              <Text style={styles.subheading}>Catalog & content updates (from Shopify)</Text>
              {shopify.storeChanges.slice(0, 12).map((change) => (
                <View style={styles.activityRow} key={change.id}>
                  <Text style={[styles.activityValue, { width: "78%" }]}>{change.message || `${change.subject} ${change.action}`}</Text>
                  <Text style={[styles.activityLabel, { width: "22%", textAlign: "right" }]}>{change.occurredAt.slice(0, 10)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </SectionPage>
      )}

      {includes("email-sms") && (
        <SectionPage eyebrow="04 · Email & SMS" title="Lifecycle marketing" clientName={clientName}>
          <Text style={styles.subheading}>Activity</Text>
          <ActivityLine label="Campaigns sent" value={manual.email.campaignsSent || klaviyo?.activity?.campaignsSent || ""} />
          <ActivityLine label="Flows active / built / optimized" value={manual.email.flowsActivity || klaviyo?.activity?.flowsSummary || ""} />
          <ActivityLine label="List growth activity" value={manual.email.listGrowthActivity || klaviyo?.activity?.listGrowthActivity || ""} />
          <ActivityLine label="A/B tests run" value={manual.email.abTests || klaviyo?.activity?.abTestsRun || ""} />
          <ActivityLine label="Highlights" value={manual.email.highlights || klaviyo?.activity?.highlights || ""} />
          <Text style={styles.subheading}>Performance</Text>
          {klaviyo ? (
            <MetricTable
              rows={deltaRows([
                { label: "Emails sent", metric: klaviyo.sent },
                { label: "Open rate", metric: klaviyo.openRate, percent: true },
                { label: "Click rate", metric: klaviyo.clickRate, percent: true },
                { label: "Conversion rate", metric: klaviyo.conversionRate, percent: true },
                { label: "Campaign revenue", metric: klaviyo.campaignRevenue ?? klaviyo.emailRevenue, currency: klaviyo.currency },
                { label: "List growth", metric: klaviyo.listGrowth ?? klaviyo.newSubscribers },
                { label: "Unsubscribe rate", metric: klaviyo.unsubscribeRate, percent: true },
              ])}
            />
          ) : (
            <Text style={styles.muted}>Klaviyo not connected. Performance metrics will appear here once an API key is saved in client settings.</Text>
          )}
          {klaviyo?.topFlows?.length ? (
            <>
              <Text style={styles.subheading}>Top flows</Text>
              {klaviyo.topFlows.map((flow) => (
                <View style={styles.activityRow} key={flow.id}>
                  <Text style={styles.activityLabel}>{flow.name}</Text>
                  <Text style={styles.activityValue}>{fmt(flow.revenue, { currency: klaviyo.currency })}</Text>
                </View>
              ))}
            </>
          ) : null}
          <NextMonth value={manual.email.nextMonth} />
        </SectionPage>
      )}

      {includes("influencer-ugc") && (
        <SectionPage eyebrow="05 · Influencer & UGC" title="Creator partnerships" clientName={clientName}>
          <Text style={styles.subheading}>Activity</Text>
          <ActivityLine label="Collaborations activated" value={manual.influencer.collaborations} />
          <ActivityLine label="Creators sourced / outreach sent" value={manual.influencer.creatorsOutreach} />
          <ActivityLine label="UGC assets delivered" value={manual.influencer.ugcAssets} />
          <ActivityLine label="Top performing creator" value={manual.influencer.topCreator} />
          <ActivityLine label="Gifting sent" value={manual.influencer.gifting} />
          {manual.influencer.performanceNotes.trim() ? (
            <>
              <Text style={styles.subheading}>Performance</Text>
              <Text style={styles.body}>{manual.influencer.performanceNotes.trim()}</Text>
            </>
          ) : null}
          <NextMonth value={manual.influencer.nextMonth} />
        </SectionPage>
      )}

      {includes("content-creation") && (
        <SectionPage eyebrow="06 · Content Creation" title="Assets delivered" clientName={clientName}>
          <ActivityLine label="Photo shoots" value={manual.content.photoShoots} />
          <ActivityLine label="Images delivered" value={manual.content.imagesDelivered} />
          <ActivityLine label="Videos / Reels produced" value={manual.content.videosProduced} />
          <ActivityLine label="Ad creative (static)" value={manual.content.adCreativeStatic} />
          <ActivityLine label="Ad creative (video)" value={manual.content.adCreativeVideo} />
          <ActivityLine label="Other assets" value={manual.content.otherAssets} />
          <NextMonth value={manual.content.nextMonth} />
        </SectionPage>
      )}

      {includes("google-business") && (
        <SectionPage eyebrow="07 · Google" title="Google Business Profile" clientName={clientName}>
          <Text style={styles.subheading}>Activity</Text>
          <ActivityLine label="Listing updates made" value={manual.googleBusiness.listingUpdates} />
          <ActivityLine label="New reviews responded to" value={manual.googleBusiness.reviewsResponded} />
          <ActivityLine label="Posts / offers published" value={manual.googleBusiness.postsPublished} />
          <NextMonth value={manual.googleBusiness.nextMonth} />
        </SectionPage>
      )}

      {includes("executive-summary") && (
        <SectionPage eyebrow="Summary & Notes" title="What matters this month" clientName={clientName}>
          {snapshot.executiveSummary.map((item) => (
            <View key={item} style={[styles.noteBox, { marginBottom: 8 }]}>
              <Text style={styles.body}>{item}</Text>
            </View>
          ))}
          {manual.summary.overall.trim() ? (
            <>
              <Text style={styles.subheading}>Team notes</Text>
              <Text style={styles.body}>{manual.summary.overall.trim()}</Text>
            </>
          ) : null}
          {manual.summary.nextMonthFocus.trim() ? (
            <>
              <Text style={styles.subheading}>Focus for next month</Text>
              <Text style={styles.body}>{manual.summary.nextMonthFocus.trim()}</Text>
            </>
          ) : null}
          <View style={{ marginTop: 28 }}>
            <Text style={styles.body}>As always, reach out anytime. We&apos;re here.</Text>
            <Text style={[styles.brandMark, { marginTop: 20, marginBottom: 4 }]}>Rebel ● Marketing</Text>
            <Text style={styles.muted}>Creative-first. Performance-led. Brand-obsessed.</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>contact@rebelmarketingcafe.com · rebelmarketingcafe.com</Text>
          </View>
        </SectionPage>
      )}
    </Document>
  );
}
