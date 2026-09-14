/**
 * Single source of truth for the client-facing PDF sections the team can toggle.
 * `requires` names the data source a section needs, so sections for sources a
 * client hasn't connected can be filtered out instead of rendering empty pages.
 */
export const REPORT_SECTIONS = [
  { id: "executive-summary", label: "Executive summary", description: "Narrative highlights and the biggest movers.", requires: null },
  { id: "shopify", label: "Shopify store performance", description: "Revenue, orders, average order value, and top products.", requires: "shopify" },
  { id: "storefront-funnel", label: "Storefront funnel", description: "Sessions, add-to-cart rate, conversion, and traffic breakdowns.", requires: "shopify" },
  { id: "klaviyo", label: "Klaviyo email & SMS", description: "Email revenue, engagement rates, and top flows.", requires: "klaviyo" },
  { id: "meta", label: "Meta Ads", description: "Ad spend, ROAS, purchases, and top campaigns.", requires: "meta" },
  { id: "comparison", label: "Month-over-month comparison", description: "Side-by-side table of headline metrics.", requires: null },
  { id: "store-changes", label: "Store changes", description: "Catalog and content updates plus live theme status.", requires: "shopify" },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"];

export const ALL_SECTION_IDS = REPORT_SECTIONS.map((section) => section.id) as ReportSectionId[];

function isSectionId(value: unknown): value is ReportSectionId {
  return typeof value === "string" && (ALL_SECTION_IDS as string[]).includes(value);
}

/**
 * Keeps stored selections usable as sections are added or renamed. An empty or
 * missing selection means "everything", so existing reports keep their content.
 */
export function normalizeSections(value: unknown): ReportSectionId[] {
  if (!Array.isArray(value)) return [...ALL_SECTION_IDS];
  const selected = value.filter(isSectionId);
  if (!selected.length) return [...ALL_SECTION_IDS];
  return ALL_SECTION_IDS.filter((id) => selected.includes(id));
}

/** Section ids that make sense for a client, given which sources are connected. */
export function sectionsForSources(available: Record<string, boolean>): ReportSectionId[] {
  return REPORT_SECTIONS.filter((section) => !section.requires || available[section.requires]).map((section) => section.id);
}
