"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildMonthOptions,
  buildPeriodPresets,
  exclusiveEndFromInclusiveMonth,
  rangeLabel,
  type ReportPeriodSelection,
} from "@/lib/reports/period-presets";

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const presets = useMemo(() => buildPeriodPresets(), []);
  const months = useMemo(() => buildMonthOptions(), []);
  const defaultPeriod = presets[0]!;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selected, setSelected] = useState<ReportPeriodSelection>(defaultPeriod);
  const [customStart, setCustomStart] = useState(defaultPeriod.start);
  const [customEndMonth, setCustomEndMonth] = useState(defaultPeriod.start);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function applyCustom() {
    try {
      const end = exclusiveEndFromInclusiveMonth(customStart, customEndMonth);
      setSelected({
        id: `custom-${customStart}-${end}`,
        label: rangeLabel(customStart, end),
        start: customStart,
        end,
      });
      setMode("custom");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid custom range.");
    }
  }

  async function generate() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, start: selected.start, end: selected.end }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    setMessage(response.ok ? `${selected.label} report ${body.status}.` : (body.error ?? "Unable to generate report."));
    if (response.ok) window.location.reload();
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2" ref={rootRef}>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarRange size={16} className="text-[var(--brand)]" />
        <span>{selected.label}</span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="font-display text-sm font-semibold text-[var(--ink)]">Report period</p>
            <p className="text-xs text-[var(--muted)]">Months, quarters, or a custom range.</p>
          </div>
          <div className="max-h-72 overflow-auto p-2">
            {presets.map((preset) => {
              const active = mode === "preset" && selected.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`flex w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active ? "bg-brand-soft font-semibold text-brand-dark" : "text-slate-700 hover:bg-surface-muted"
                  }`}
                  onClick={() => {
                    setSelected(preset);
                    setMode("preset");
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[var(--border)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--muted)]">
                From
                <select
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="mt-1 min-h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-slate-700"
                >
                  {months.map((option) => (
                    <option key={`from-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--muted)]">
                Through
                <select
                  value={customEndMonth}
                  onChange={(event) => setCustomEndMonth(event.target.value)}
                  className="mt-1 min-h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-slate-700"
                >
                  {months.map((option) => (
                    <option key={`to-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={applyCustom}>
              Use custom range
            </Button>
          </div>
        </div>
      ) : null}

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
