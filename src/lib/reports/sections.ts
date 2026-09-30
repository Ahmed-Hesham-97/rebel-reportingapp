/**
 * Single source of truth for the client-facing PDF sections the team can toggle.
 * Mirrors the Rebel Marketing Monthly Report template. `requires` names the
 * integration a section needs so empty pages are hidden when a source isn't connected.
 * Sections without `requires` always show — they use manual fields and/or optional APIs.
 */
export const REPORT_SECTIONS = [
  {
    id: "executive-summary",
    label: "Summary & notes",
    description: "Overall performance narrative and next-month focus.",
    requires: null,
  },
  {
    id: "social-media",
    label: "01 · Social media",
    description: "Organic activity and performance — entered manually.",
    requires: null,
  },
  {
    id: "paid-media",
    label: "02 · Paid media",
    description: "Meta Ads and Google Ads entered manually.",
    requires: null,
  },
  {
    id: "website",
    label: "03 · Website",
    description: "Shopify sessions, revenue, AOV, funnel, and store updates.",
    requires: "shopify",
  },
  {
    id: "email-sms",
    label: "04 · Email & SMS",
    description: "Klaviyo metrics when connected, plus campaign activity notes.",
    requires: null,
  },
  {
    id: "influencer-ugc",
    label: "05 · Influencer & UGC",
    description: "Collaborations, creators, and UGC — entered manually.",
    requires: null,
  },
  {
    id: "content-creation",
    label: "06 · Content creation",
    description: "Assets delivered this period — entered manually.",
    requires: null,
  },
  {
    id: "google-business",
    label: "07 · Google Business",
    description: "Listing updates and reviews — entered manually when applicable.",
    requires: null,
  },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"];

export const ALL_SECTION_IDS = REPORT_SECTIONS.map((section) => section.id) as ReportSectionId[];

function isSectionId(value: unknown): value is ReportSectionId {
  return typeof value === "string" && (ALL_SECTION_IDS as string[]).includes(value);
}

/** Maps legacy section ids saved before the template restructure. */
const LEGACY_SECTION_MAP: Record<string, ReportSectionId> = {
  shopify: "website",
  "storefront-funnel": "website",
  "store-changes": "website",
  klaviyo: "email-sms",
  meta: "paid-media",
  comparison: "website",
};

/**
 * Keeps stored selections usable as sections are added or renamed. An empty or
 * missing selection means "everything", so existing reports keep their content.
 */
export function normalizeSections(value: unknown): ReportSectionId[] {
  if (!Array.isArray(value)) return [...ALL_SECTION_IDS];
  const selected = new Set<ReportSectionId>();
  for (const item of value) {
    if (isSectionId(item)) selected.add(item);
    else if (typeof item === "string" && LEGACY_SECTION_MAP[item]) selected.add(LEGACY_SECTION_MAP[item]);
  }
  if (!selected.size) return [...ALL_SECTION_IDS];
  return ALL_SECTION_IDS.filter((id) => selected.has(id));
}

/** Section ids that make sense for a client, given which sources are connected. */
export function sectionsForSources(available: Record<string, boolean>): ReportSectionId[] {
  return REPORT_SECTIONS.filter((section) => !section.requires || available[section.requires]).map((section) => section.id);
}
