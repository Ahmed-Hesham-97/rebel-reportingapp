"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function monthValue(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

/** Last N closed/current months as YYYY-MM-01 options (newest first). */
function buildMonthOptions(count = 18) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const value = monthValue(date.getUTCFullYear(), date.getUTCMonth());
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const months = useMemo(() => buildMonthOptions(), []);
  // Default to previous calendar month (same as the old “latest” behavior).
  const [month, setMonth] = useState(months[1]?.value ?? months[0]!.value);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, month }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    setMessage(response.ok ? `${monthLabel(month)} report ${body.status}.` : (body.error ?? "Unable to generate report."));
    if (response.ok) window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`report-month-${clientId}`}>
        Report month
      </label>
      <select
        id={`report-month-${clientId}`}
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        disabled={pending}
        className="min-h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {months.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button onClick={generate} disabled={pending}>
        {pending ? "Generating…" : "Generate report"}
      </Button>
      {message ? (
        <span role="status" className="w-full text-xs text-slate-500 sm:w-auto">
          {message}
        </span>
      ) : null}
    </div>
  );
}
