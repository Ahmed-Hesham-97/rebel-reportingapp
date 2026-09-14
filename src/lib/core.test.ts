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
    expect(period.current.start).toContain("2026-02");
    expect(period.previous.start).toContain("2026-01");
  });

  it("calculates percentage deltas safely", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(1, 0)).toBeNull();
  });

  it("identifies a positive and negative headline movement", () => {
    const source = (changePct: number) => ({ status: "success" as const, data: { revenue: { current: 1, previous: 1, changePct }, roas: { current: 1, previous: 1, changePct }, emailRevenue: { current: 1, previous: 1, changePct } }, fetchedAt: new Date().toISOString() });
    const summary = buildExecutiveSummary({ shopify: source(25), klaviyo: source(-10), meta: source(4) } as never);
    expect(summary[0]).toContain("Shopify revenue");
    expect(summary[1]).toContain("Klaviyo");
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
