import "server-only";

import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { ReportPeriod } from "@/types/report";
export type { ReportPeriod } from "@/types/report";

function localDate(year: number, month: number, day: number, timezone: string) {
  return fromZonedTime(new Date(Date.UTC(year, month, day)), timezone);
}

export function getPreviousMonthPeriod(now = new Date(), timezone = "UTC"): ReportPeriod {
  const zonedNow = toZonedTime(now, timezone);
  const previousMonth = new Date(Date.UTC(zonedNow.getFullYear(), zonedNow.getMonth() - 1, 1));
  return getReportMonthPeriod(`${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}-01`, timezone);
}

export function getReportMonthPeriod(reportMonth: string, timezone = "UTC"): ReportPeriod {
  const [yearText, monthText] = reportMonth.split("-");
  const reportYear = Number(yearText);
  const reportMonthIndex = Number(monthText) - 1;
  const currentStart = localDate(reportYear, reportMonthIndex, 1, timezone);
  const currentEnd = localDate(reportYear, reportMonthIndex + 1, 1, timezone);
  const previousStart = localDate(reportYear, reportMonthIndex - 1, 1, timezone);
  const previousEnd = currentStart;
  return {
    reportMonth: formatInTimeZone(currentStart, timezone, "yyyy-MM-dd"),
    current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
    previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() },
    timezone,
  };
}

export function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function metric(current: number | null, previous: number | null) {
  return { current, previous, changePct: percentChange(current, previous) };
}
