/**
 * Shared period helpers for the report generator UI (month / quarter / custom).
 * Dates use half-open [start, end) windows on calendar months.
 */

export type ReportPeriodSelection = {
  id: string;
  label: string;
  start: string;
  end: string;
};

function monthStart(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function addMonths(year: number, monthIndex: number, delta: number) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

function monthLabel(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  );
}

export function rangeLabel(start: string, end: string) {
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7)) - 1;
  const endDate = addMonths(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, -1);
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(sy, sm, 1)),
  );
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(endDate.year, endDate.monthIndex, 1)),
  );
  if (sy === endDate.year && sm === endDate.monthIndex) return monthLabel(sy, sm);
  if (sy === endDate.year) {
    const startMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(sy, sm, 1)));
    return `${startMonth}–${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

function quarterWindow(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = monthStart(year, startMonth);
  const endParts = addMonths(year, startMonth, 3);
  return {
    id: `q${quarter}-${year}`,
    label: `Q${quarter} ${year}`,
    start,
    end: monthStart(endParts.year, endParts.monthIndex),
  } satisfies ReportPeriodSelection;
}

export function buildPeriodPresets(now = new Date()): ReportPeriodSelection[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const thisMonthStart = monthStart(year, month);
  const nextMonth = addMonths(year, month, 1);
  const lastMonth = addMonths(year, month, -1);
  const last3 = addMonths(year, month, -3);
  const currentQuarter = Math.floor(month / 3) + 1;
  const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const previousQuarterYear = currentQuarter === 1 ? year - 1 : year;

  const presets: ReportPeriodSelection[] = [
    {
      id: "last-month",
      label: `Last month (${monthLabel(lastMonth.year, lastMonth.monthIndex)})`,
      start: monthStart(lastMonth.year, lastMonth.monthIndex),
      end: thisMonthStart,
    },
    {
      id: "this-month",
      label: `This month (${monthLabel(year, month)})`,
      start: thisMonthStart,
      end: monthStart(nextMonth.year, nextMonth.monthIndex),
    },
    {
      id: "last-3-months",
      label: `Last 3 months (${rangeLabel(monthStart(last3.year, last3.monthIndex), thisMonthStart)})`,
      start: monthStart(last3.year, last3.monthIndex),
      end: thisMonthStart,
    },
    {
      ...quarterWindow(previousQuarterYear, previousQuarter),
      label: `Last quarter (Q${previousQuarter} ${previousQuarterYear})`,
    },
    {
      ...quarterWindow(year, currentQuarter),
      label: `This quarter (Q${currentQuarter} ${year})`,
    },
  ];

  for (const y of [year, year - 1]) {
    for (let q = 4; q >= 1; q--) {
      const item = quarterWindow(y, q);
      if (!presets.some((preset) => preset.id === item.id)) presets.push(item);
    }
  }

  return presets;
}

export function buildMonthOptions(count = 24) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    options.push({
      value: monthStart(date.getUTCFullYear(), date.getUTCMonth()),
      label: monthLabel(date.getUTCFullYear(), date.getUTCMonth()),
    });
  }
  return options;
}

export function exclusiveEndFromInclusiveMonth(startMonth: string, endMonthInclusive: string) {
  const year = Number(endMonthInclusive.slice(0, 4));
  const monthIndex = Number(endMonthInclusive.slice(5, 7)) - 1;
  const next = addMonths(year, monthIndex, 1);
  const end = monthStart(next.year, next.monthIndex);
  if (!(end > startMonth)) throw new Error("End month must be on or after the start month.");
  return end;
}
