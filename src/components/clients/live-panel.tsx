"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Metric = { current: number | null; changePct: number | null };
type LiveData = { shopify?: { revenue: Metric; orders: Metric; aov: Metric } | null; klaviyo?: { emailRevenue: Metric } | null; meta?: { spend: Metric; roas: Metric } | null };

export function LivePanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function refresh() {
    setPending(true); setMessage("");
    const response = await fetch(`/api/clients/${clientId}/live`);
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) { setMessage(body.error ?? "Unable to load live data."); return; }
    setData(body); 
  }
  return <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Live performance</CardTitle><p className="mt-1 text-sm text-slate-500">Fetch the latest available data from connected channels.</p></div><Button variant="outline" size="sm" onClick={refresh} disabled={pending}>{pending ? "Refreshing…" : "Refresh"}</Button></CardHeader><CardContent>{message && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}{!data ? <p className="text-sm text-slate-500">Refresh to load live channel data.</p> : <div className="grid gap-3 sm:grid-cols-3"><LiveMetric label="Shopify revenue" metric={data.shopify?.revenue} currency /><LiveMetric label="Email revenue" metric={data.klaviyo?.emailRevenue} currency /><LiveMetric label="Meta ROAS" metric={data.meta?.roas} /></div>}</CardContent></Card>;
}

function LiveMetric({ label, metric, currency = false }: { label: string; metric?: Metric; currency?: boolean }) {
  const current = metric?.current;
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold">{currency ? formatCurrency(current) : current == null ? "—" : current.toFixed(2)}</p><p className="mt-1 text-xs text-slate-500">{metric?.changePct == null ? "No comparison" : `${formatPercent(metric.changePct)} MoM`}</p></div>;
}
