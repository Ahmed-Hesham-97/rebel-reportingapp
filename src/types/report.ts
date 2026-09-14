export type SourceName = "shopify" | "klaviyo" | "meta";
export type SourceStatus = "success" | "failed" | "unavailable";

export type DeltaMetric = {
  current: number | null;
  previous: number | null;
  changePct: number | null;
};

export type SourceResult<T> = {
  status: SourceStatus;
  data: T | null;
  error?: string;
  fetchedAt: string;
};

export type ReportPeriod = {
  reportMonth: string;
  current: { start: string; end: string };
  previous: { start: string; end: string };
  timezone: string;
};

export type ProductPerformance = { id: string; title: string; revenue: number; orders: number };
export type TrafficSlice = { label: string; sessions: number; conversionRate: number | null };
export type StoreChange = { id: string; subject: string; action: string; message: string; occurredAt: string };
export type ThemeStatus = { name: string; role: string; updatedAt: string };

/** Online store funnel from the ShopifyQL `sessions` schema. Null when the app lacks `read_reports`. */
export type StorefrontFunnel = {
  sessions: DeltaMetric;
  onlineStoreVisitors: DeltaMetric;
  addedToCartRate: DeltaMetric;
  conversionRate: DeltaMetric;
  checkoutConversionRate: DeltaMetric;
  bounceRate: DeltaMetric;
  byReferrerSource: TrafficSlice[];
  byDeviceType: TrafficSlice[];
};
export type CampaignPerformance = { id: string; name: string; revenue: number | null; roas?: number; conversions?: number };

export type ShopifyMetrics = {
  currency: string;
  revenue: DeltaMetric;
  orders: DeltaMetric;
  aov: DeltaMetric;
  conversionRate: DeltaMetric | null;
  newCustomers: DeltaMetric;
  returningCustomers: DeltaMetric;
  refundRate: DeltaMetric;
  topProducts: ProductPerformance[];
  dailyRevenue: Array<{ date: string; current: number; previous: number }>;
  funnel: StorefrontFunnel | null;
  storeChanges: StoreChange[];
  theme: ThemeStatus | null;
};

export type KlaviyoMetrics = {
  currency: string;
  emailRevenue: DeltaMetric;
  sent: DeltaMetric;
  delivered: DeltaMetric;
  opened: DeltaMetric;
  clicked: DeltaMetric;
  openRate: DeltaMetric;
  clickRate: DeltaMetric;
  conversionRate: DeltaMetric;
  topFlows: CampaignPerformance[];
  topCampaigns: CampaignPerformance[];
  newSubscribers: DeltaMetric;
  unsubscribes: DeltaMetric;
  sms: { enabled: boolean; sent: DeltaMetric; clicked: DeltaMetric; revenue: DeltaMetric };
};

export type MetaMetrics = {
  currency: string;
  spend: DeltaMetric;
  roas: DeltaMetric;
  cpm: DeltaMetric;
  cpc: DeltaMetric;
  ctr: DeltaMetric;
  purchases: DeltaMetric;
  purchaseValue: DeltaMetric;
  topCampaigns: CampaignPerformance[];
  topAdSets: CampaignPerformance[];
  byPlatform: Array<{ platform: "facebook" | "instagram"; spend: number; purchases: number; purchaseValue: number }>;
};

export type ReportSnapshot = {
  id: string;
  clientId: string;
  reportMonth: string;
  status: "pending" | "processing" | "partial" | "completed" | "failed";
  period: ReportPeriod;
  shopify: SourceResult<ShopifyMetrics>;
  klaviyo: SourceResult<KlaviyoMetrics>;
  meta: SourceResult<MetaMetrics>;
  executiveSummary: string[];
  pdfUrl: string | null;
  createdAt: string;
  /** Sections the team approved for the client PDF. */
  includedSections: string[];
  /** Null until someone reviews the report and sends it. */
  deliveredAt: string | null;
};
