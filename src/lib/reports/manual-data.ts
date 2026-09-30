import { z } from "zod";

const str = () => z.string().default("");

/** Accept a string[], a single URL string, or legacy `{ topContentImage }` and normalize to string[]. */
function imageList() {
  return z.preprocess((value) => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  }, z.array(z.string()).default([]));
}

const socialObjectSchema = z.object({
  platformsActive: str(),
  feedPosts: str(),
  reels: str(),
  stories: str(),
  communityManagement: str(),
  topContent: str(),
  /** Public URLs of pasted/uploaded screenshots for top performing content. */
  topContentImages: imageList(),
  highlights: str(),
  reach: str(),
  reachPrev: str(),
  impressions: str(),
  impressionsPrev: str(),
  engagementRate: str(),
  engagementRatePrev: str(),
  followerGrowth: str(),
  followerGrowthPrev: str(),
  profileVisits: str(),
  profileVisitsPrev: str(),
  linkClicks: str(),
  linkClicksPrev: str(),
  savesShares: str(),
  savesSharesPrev: str(),
  nextMonth: str(),
});

const socialSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  // Migrate the old single-image field into the list.
  if (!row.topContentImages && typeof row.topContentImage === "string" && row.topContentImage.trim()) {
    return { ...row, topContentImages: [row.topContentImage.trim()] };
  }
  return row;
}, socialObjectSchema);

const paidSchema = z.object({
  metaNotes: str(),
  metaSpend: str(),
  metaSpendPrev: str(),
  metaPurchases: str(),
  metaPurchasesPrev: str(),
  metaConversionValue: str(),
  metaConversionValuePrev: str(),
  metaRoas: str(),
  metaRoasPrev: str(),
  metaConversionRate: str(),
  metaConversionRatePrev: str(),
  metaTopCampaigns: str(),
  googleSpend: str(),
  googleSpendPrev: str(),
  googlePurchases: str(),
  googlePurchasesPrev: str(),
  googleConversionValue: str(),
  googleConversionValuePrev: str(),
  googleRoas: str(),
  googleRoasPrev: str(),
  googleConversionRate: str(),
  googleConversionRatePrev: str(),
  googleNotes: str(),
});

const websiteSchema = z.object({
  homepageUpdates: str(),
  newPages: str(),
  productPageUpdates: str(),
  speedPerformance: str(),
  bugFixes: str(),
  croChanges: str(),
});

const emailSchema = z.object({
  campaignsSent: str(),
  flowsActivity: str(),
  listGrowthActivity: str(),
  abTests: str(),
  highlights: str(),
  nextMonth: str(),
});

const influencerSchema = z.object({
  collaborations: str(),
  creatorsOutreach: str(),
  ugcAssets: str(),
  topCreator: str(),
  gifting: str(),
  performanceNotes: str(),
  nextMonth: str(),
});

const contentSchema = z.object({
  photoShoots: str(),
  imagesDelivered: str(),
  videosProduced: str(),
  adCreativeStatic: str(),
  adCreativeVideo: str(),
  otherAssets: str(),
  nextMonth: str(),
});

const googleBusinessSchema = z.object({
  listingUpdates: str(),
  reviewsResponded: str(),
  postsPublished: str(),
  nextMonth: str(),
});

const summarySchema = z.object({
  overall: str(),
  nextMonthFocus: str(),
});

function section<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value && typeof value === "object" ? value : {}), schema);
}

/**
 * Fields from the Rebel Marketing Monthly Report template that cannot be
 * pulled from Shopify / Klaviyo (Meta Ads and Google Ads are entered manually).
 * Edited on the report page and merged into the PDF at download time.
 */
export const manualReportDataSchema = z.object({
  social: section(socialSchema),
  paid: section(paidSchema),
  website: section(websiteSchema),
  email: section(emailSchema),
  influencer: section(influencerSchema),
  content: section(contentSchema),
  googleBusiness: section(googleBusinessSchema),
  summary: section(summarySchema),
});

export type ManualReportData = z.infer<typeof manualReportDataSchema>;

export function emptyManualData(): ManualReportData {
  return normalizeManualData({});
}

export function normalizeManualData(value: unknown): ManualReportData {
  const parsed = manualReportDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : manualReportDataSchema.parse({});
}

/** True when any manual field has been filled in. */
export function hasManualContent(data: ManualReportData) {
  const walk = (value: unknown): boolean => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(walk);
    if (value && typeof value === "object") return Object.values(value).some(walk);
    return false;
  };
  return walk(data);
}
