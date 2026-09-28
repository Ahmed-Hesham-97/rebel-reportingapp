import { describe, expect, it, beforeEach } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { getReportMonthPeriod, percentChange } from "@/lib/reports/date-range";
import { buildExecutiveSummary } from "@/lib/reports/executive-summary";
import { ALL_SECTION_IDS, normalizeSections } from "@/lib/reports/sections";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "a".repeat(32);
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "service-key-for-tests";
  process.env.ENCRYPTION_KEY = "b".repeat(64);
  process.env.RESEND_API_KEY = "re_test";
  process.env.CRON_SECRET = "c".repeat(16);
});

describe("secret encryption", () => {
  it("round trips and rejects tampering", () => {
    const encrypted = encryptSecret("private-token");
    expect(decryptSecret(encrypted)).toBe("private-token");
    expect(() => decryptSecret(`${encrypted}x`)).toThrow();
  });
});

describe("report periods", () => {
  it("creates an inclusive calendar month window in a named timezone", () => {
    const period = getReportMonthPeriod("2026-02-01", "America/New_York");
    expect(period.reportMonth).toBe("2026-02-01");
    expect(period.periodEnd).toBe("2026-03-01");
    expect(period.current.start).toContain("2026-02");
    expect(period.previous.start).toContain("2026-01");
  });

  it("builds quarter-length comparison windows", async () => {
    const { getReportRangePeriod } = await import("@/lib/reports/date-range");
    const period = getReportRangePeriod("2026-04-01", "2026-07-01", "UTC");
    expect(period.reportMonth).toBe("2026-04-01");
    expect(period.periodEnd).toBe("2026-07-01");
    expect(new Date(period.previous.end).toISOString()).toBe(period.current.start);
    expect(new Date(period.previous.start) < new Date(period.previous.end)).toBe(true);
  });

  it("keeps shop-calendar month bounds for UTC+ shops", async () => {
    const { formatInTimeZone } = await import("date-fns-tz");
    const period = getReportMonthPeriod("2026-05-01", "Australia/Sydney");
    expect(formatInTimeZone(new Date(period.current.start), "Australia/Sydney", "yyyy-MM-dd")).toBe("2026-05-01");
    expect(formatInTimeZone(new Date(period.current.end), "Australia/Sydney", "yyyy-MM-dd")).toBe("2026-06-01");
  });

  it("calculates percentage deltas safely", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(1, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(1, null)).toBeNull();
  });

  it("identifies a positive and negative headline movement", () => {
    const source = (changePct: number) => ({ status: "success" as const, data: { revenue: { current: 1, previous: 1, changePct }, roas: { current: 1, previous: 1, changePct }, emailRevenue: { current: 1, previous: 1, changePct } }, fetchedAt: new Date().toISOString() });
    const summary = buildExecutiveSummary({ shopify: source(25), klaviyo: source(-10), meta: source(4) } as never);
    expect(summary[0]).toContain("Shopify revenue");
    expect(summary[1]).toContain("Klaviyo");
  });
});

describe("shopify store URL normalization", () => {
  it("maps admin links and bare handles to myshopify.com", async () => {
    const { toShopDomain, isValidShopDomain, toShopifyStoreUrl } = await import("@/lib/integrations/shopify-oauth");
    expect(toShopDomain("https://admin.shopify.com/store/mollyandstitchus")).toBe("mollyandstitchus.myshopify.com");
    expect(toShopDomain("https://mollyandstitchus.myshopify.com/admin")).toBe("mollyandstitchus.myshopify.com");
    expect(toShopDomain("mollyandstitchus")).toBe("mollyandstitchus.myshopify.com");
    expect(isValidShopDomain(toShopDomain("https://admin.shopify.com/store/mollyandstitchus"))).toBe(true);
    expect(toShopifyStoreUrl("https://admin.shopify.com/store/mollyandstitchus")).toBe("https://mollyandstitchus.myshopify.com");
  });
});

describe("shopify oauth state", () => {
  it("round trips client id without cookies and rejects tampering", async () => {
    const { createOauthState, parseOauthState } = await import("@/lib/integrations/shopify-oauth");
    const state = createOauthState("client-123");
    expect(parseOauthState(state)?.clientId).toBe("client-123");
    expect(parseOauthState(`${state}x`)).toBeNull();
    expect(parseOauthState(null)).toBeNull();
  });
});

describe("report section selection", () => {
  it("treats missing or empty selections as the full report", () => {
    expect(normalizeSections(null)).toEqual(ALL_SECTION_IDS);
    expect(normalizeSections([])).toEqual(ALL_SECTION_IDS);
  });

  it("drops unknown ids and restores the canonical page order", () => {
    expect(normalizeSections(["meta", "not-a-section", "shopify"])).toEqual(["shopify", "meta"]);
  });
});
