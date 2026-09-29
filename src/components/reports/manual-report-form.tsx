"use client";

import { useState, type ChangeEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePasteField } from "@/components/reports/image-paste-field";
import { normalizeManualData, type ManualReportData } from "@/lib/reports/manual-data";

type Props = {
  reportId: string;
  initial: ManualReportData;
};

type Field = { key: string; label: string; multiline?: boolean; image?: boolean };
type Section = { title: string; hint: string; path: keyof ManualReportData; fields: Field[] };

const SECTIONS: Section[] = [
  {
    title: "01 · Social media",
    hint: "Organic activity and platform metrics — not available from Shopify.",
    path: "social",
    fields: [
      { key: "platformsActive", label: "Platforms active" },
      { key: "feedPosts", label: "Feed posts published" },
      { key: "reels", label: "Reels / short-form videos" },
      { key: "stories", label: "Stories published" },
      { key: "communityManagement", label: "Community management (DMs / comments)", multiline: true },
      { key: "topContent", label: "Top performing content (caption)", multiline: true },
      { key: "topContentImage", label: "Top performing content (image)", image: true },
      { key: "highlights", label: "Highlights & wins", multiline: true },
      { key: "reach", label: "Reach (current)" },
      { key: "reachPrev", label: "Reach (previous)" },
      { key: "impressions", label: "Impressions (current)" },
      { key: "impressionsPrev", label: "Impressions (previous)" },
      { key: "engagementRate", label: "Engagement rate (current)" },
      { key: "engagementRatePrev", label: "Engagement rate (previous)" },
      { key: "followerGrowth", label: "Follower growth (current)" },
      { key: "followerGrowthPrev", label: "Follower growth (previous)" },
      { key: "profileVisits", label: "Profile visits (current)" },
      { key: "profileVisitsPrev", label: "Profile visits (previous)" },
      { key: "linkClicks", label: "Link clicks (current)" },
      { key: "linkClicksPrev", label: "Link clicks (previous)" },
      { key: "savesShares", label: "Saves & shares (current)" },
      { key: "savesSharesPrev", label: "Saves & shares (previous)" },
      { key: "nextMonth", label: "Next month →", multiline: true },
    ],
  },
  {
    title: "02 · Paid media (manual)",
    hint: "Meta Ads numbers pull automatically when connected. Enter Google Ads and any Meta notes here.",
    path: "paid",
    fields: [
      { key: "metaNotes", label: "Meta activity notes", multiline: true },
      { key: "googleSpend", label: "Google Ads spend (current)" },
      { key: "googleSpendPrev", label: "Google Ads spend (previous)" },
      { key: "googlePurchases", label: "Google purchases (current)" },
      { key: "googlePurchasesPrev", label: "Google purchases (previous)" },
      { key: "googleConversionValue", label: "Google conversion value (current)" },
      { key: "googleConversionValuePrev", label: "Google conversion value (previous)" },
      { key: "googleRoas", label: "Google ROAS (current)" },
      { key: "googleRoasPrev", label: "Google ROAS (previous)" },
      { key: "googleConversionRate", label: "Google conversion rate (current)" },
      { key: "googleConversionRatePrev", label: "Google conversion rate (previous)" },
      { key: "googleNotes", label: "Google Ads notes", multiline: true },
    ],
  },
  {
    title: "03 · Website (manual notes)",
    hint: "Shopify fills sessions, revenue, AOV, funnel, and catalog changes. Add development notes here.",
    path: "website",
    fields: [
      { key: "homepageUpdates", label: "Homepage / banner updates", multiline: true },
      { key: "newPages", label: "New pages built", multiline: true },
      { key: "productPageUpdates", label: "Product page updates", multiline: true },
      { key: "speedPerformance", label: "Speed & performance", multiline: true },
      { key: "bugFixes", label: "Bug fixes / technical", multiline: true },
      { key: "croChanges", label: "CRO changes tested", multiline: true },
    ],
  },
  {
    title: "04 · Email & SMS (manual notes)",
    hint: "Klaviyo fills performance when connected. Capture campaign activity here.",
    path: "email",
    fields: [
      { key: "campaignsSent", label: "Campaigns sent", multiline: true },
      { key: "flowsActivity", label: "Flows active / built / optimized", multiline: true },
      { key: "listGrowthActivity", label: "List growth activity", multiline: true },
      { key: "abTests", label: "A/B tests run", multiline: true },
      { key: "highlights", label: "Highlights", multiline: true },
      { key: "nextMonth", label: "Next month →", multiline: true },
    ],
  },
  {
    title: "05 · Influencer & UGC",
    hint: "Entered manually — no Shopify source for creator work.",
    path: "influencer",
    fields: [
      { key: "collaborations", label: "Collaborations activated", multiline: true },
      { key: "creatorsOutreach", label: "Creators sourced / outreach sent", multiline: true },
      { key: "ugcAssets", label: "UGC assets delivered", multiline: true },
      { key: "topCreator", label: "Top performing creator" },
      { key: "gifting", label: "Gifting sent", multiline: true },
      { key: "performanceNotes", label: "Performance notes", multiline: true },
      { key: "nextMonth", label: "Next month →", multiline: true },
    ],
  },
  {
    title: "06 · Content creation",
    hint: "Assets delivered this period.",
    path: "content",
    fields: [
      { key: "photoShoots", label: "Photo shoots" },
      { key: "imagesDelivered", label: "Images delivered" },
      { key: "videosProduced", label: "Videos / Reels produced" },
      { key: "adCreativeStatic", label: "Ad creative (static)" },
      { key: "adCreativeVideo", label: "Ad creative (video)" },
      { key: "otherAssets", label: "Other assets", multiline: true },
      { key: "nextMonth", label: "Next month →", multiline: true },
    ],
  },
  {
    title: "07 · Google Business",
    hint: "Optional — fill when the client uses GBP.",
    path: "googleBusiness",
    fields: [
      { key: "listingUpdates", label: "Listing updates made", multiline: true },
      { key: "reviewsResponded", label: "New reviews responded to", multiline: true },
      { key: "postsPublished", label: "Posts / offers published", multiline: true },
      { key: "nextMonth", label: "Next month →", multiline: true },
    ],
  },
  {
    title: "Summary & notes",
    hint: "Combined with auto-generated highlights in the PDF.",
    path: "summary",
    fields: [
      { key: "overall", label: "Overall performance summary", multiline: true },
      { key: "nextMonthFocus", label: "Focus for next month", multiline: true },
    ],
  },
];

export function ManualReportForm({ reportId, initial }: Props) {
  const [data, setData] = useState<ManualReportData>(() => normalizeManualData(initial));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function update(path: keyof ManualReportData, key: string, value: string) {
    setData((current) => {
      const section = { ...current[path], [key]: value };
      return { ...current, [path]: section };
    });
    setMessage("");
  }

  async function updateAndPersist(path: keyof ManualReportData, key: string, value: string) {
    const next = {
      ...data,
      [path]: { ...data[path], [key]: value },
    } as ManualReportData;
    setData(next);
    setMessage("");
    const response = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manual: next }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.error ?? "Image uploaded but could not be saved to the report.");
      return;
    }
    setMessage(value ? "Image saved to the report." : "Image removed.");
  }

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manual: data }),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.error ?? "Unable to save manual fields.");
      return;
    }
    setMessage("Manual fields saved. Download the PDF to include them.");
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => (
        <fieldset key={section.path} className="rounded-2xl border border-slate-200 p-5">
          <legend className="px-1 text-sm font-semibold text-[var(--ink)]">{section.title}</legend>
          <p className="mb-4 text-xs text-[var(--muted)]">{section.hint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const sectionData = data[section.path] as Record<string, string>;
              const value = sectionData[field.key] ?? "";
              const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                update(section.path, field.key, event.target.value);
              return (
                <div key={field.key} className={field.multiline || field.image ? "sm:col-span-2" : undefined}>
                  <Label htmlFor={`${section.path}-${field.key}`} className="mb-1.5 block text-xs text-[var(--muted)]">
                    {field.label}
                  </Label>
                  {field.image ? (
                    <ImagePasteField
                      reportId={reportId}
                      value={value}
                      onChange={(url) => void updateAndPersist(section.path, field.key, url)}
                    />
                  ) : field.multiline ? (
                    <textarea
                      id={`${section.path}-${field.key}`}
                      value={value}
                      onChange={onChange}
                      rows={3}
                      className="min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400"
                    />
                  ) : (
                    <Input id={`${section.path}-${field.key}`} value={value} onChange={onChange} />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          <Save size={16} /> {pending ? "Saving…" : "Save manual fields"}
        </Button>
        {message ? (
          <p role="status" className="text-xs text-slate-600">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
