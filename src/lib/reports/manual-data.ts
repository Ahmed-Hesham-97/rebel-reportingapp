import { z } from "zod";

const str = () => z.string().default("");

const socialSchema = z.object({
  platformsActive: str(),
  feedPosts: str(),
  reels: str(),
  stories: str(),
  communityManagement: str(),
  topContent: str(),
  /** Public URL of a pasted/uploaded screenshot for top performing content. */
  topContentImage: str(),
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

const paidSchema = z.object({
  metaNotes: str(),
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
 * pulled from Shopify (or connected Meta / Klaviyo). Edited on the report
 * page and merged into the PDF at download time.
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
    if (value && typeof value === "object") return Object.values(value).some(walk);
    return false;
  };
  return walk(data);
}
