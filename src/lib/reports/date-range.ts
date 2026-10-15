import "server-only";

import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { ReportPeriod } from "@/types/report";
export type { ReportPeriod } from "@/types/report";

function localDate(year: number, month: number, day: number, timezone: string) {
  // Wall-clock Y/M/D in the shop timezone. Do not use Date.UTC — fromZonedTime
  // reads the system's local getters and would bake in the server offset.
  return fromZonedTime(new Date(year, month, day, 0, 0, 0, 0), timezone);
}

function parseDay(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  return { year: Number(yearText), monthIndex: Number(monthText) - 1, day: Number(dayText || "1") };
}

function addMonths(year: number, monthIndex: number, delta: number) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

/** Single calendar month period with the prior month as comparison. */
export function getReportMonthPeriod(reportMonth: string, timezone = "UTC"): ReportPeriod {
  const { year, monthIndex } = parseDay(reportMonth);
  const end = addMonths(year, monthIndex, 1);
  return getReportRangePeriod(
    `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
    `${end.year}-${String(end.monthIndex + 1).padStart(2, "0")}-01`,
    timezone,
  );
}

/**
 * Arbitrary half-open range [start, end) in shop-local calendar days.
 * Comparison window is the equal-length period immediately before `start`.
 */
export function getReportRangePeriod(startDay: string, endDay: string, timezone = "UTC"): ReportPeriod {
  const start = parseDay(startDay);
  const end = parseDay(endDay);
  const currentStart = localDate(start.year, start.monthIndex, start.day, timezone);
  const currentEnd = localDate(end.year, end.monthIndex, end.day, timezone);
  if (!(currentEnd.getTime() > currentStart.getTime())) {
    throw new Error("Report period end must be after the start date.");
  }
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = currentStart;
  const previousStart = new Date(currentStart.getTime() - durationMs);
  return {
    reportMonth: formatInTimeZone(currentStart, timezone, "yyyy-MM-dd"),
    periodEnd: formatInTimeZone(currentEnd, timezone, "yyyy-MM-dd"),
    current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
    previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() },
    timezone,
  };
}

export function getPreviousMonthPeriod(now = new Date(), timezone = "UTC"): ReportPeriod {
  const zonedNow = toZonedTime(now, timezone);
  const previousMonth = new Date(Date.UTC(zonedNow.getFullYear(), zonedNow.getMonth() - 1, 1));
  return getReportMonthPeriod(`${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}-01`, timezone);
}

/** Inclusive last calendar day for a half-open [start, exclusiveEnd) window. */
function inclusiveEndDay(startDay: string, exclusiveEndDay?: string | null) {
  const start = parseDay(startDay);
  const exclusiveEnd = exclusiveEndDay
    ? parseDay(exclusiveEndDay)
    : { ...addMonths(start.year, start.monthIndex, 1), day: 1 };
  const last = new Date(Date.UTC(exclusiveEnd.year, exclusiveEnd.monthIndex, exclusiveEnd.day || 1));
  last.setUTCDate(last.getUTCDate() - 1);
  return {
    year: last.getUTCFullYear(),
    monthIndex: last.getUTCMonth(),
    day: last.getUTCDate(),
  };
}

function formatIsoDay(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Cover/PDF label: always an inclusive from–to date range. */
export function formatReportPeriodRange(startDay: string, endDay?: string | null) {
  const start = parseDay(startDay);
  const last = inclusiveEndDay(startDay, endDay);
  return `${formatIsoDay(start.year, start.monthIndex, start.day)} to ${formatIsoDay(last.year, last.monthIndex, last.day)}`;
}

/** Human label for a stored snapshot window (UI lists). */
export function formatReportPeriodLabel(startDay: string, endDay?: string | null) {
  const start = parseDay(startDay);
  const last = inclusiveEndDay(startDay, endDay);
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(start.year, start.monthIndex, 1)),
  );
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(last.year, last.monthIndex, 1)),
  );
  if (start.year === last.year && start.monthIndex === last.monthIndex) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(start.year, start.monthIndex, 1)),
    );
  }
  if (start.year === last.year) {
    const startMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(start.year, start.monthIndex, 1)),
    );
    return `${startMonth}–${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

export function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function metric(current: number | null, previous: number | null) {
  return { current, previous, changePct: percentChange(current, previous) };
}
