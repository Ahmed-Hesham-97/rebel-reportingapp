"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ShopifyMetrics } from "@/types/report";

export function RevenueChart({ data }: { data: ShopifyMetrics["dailyRevenue"] }) {
  if (!data.length) return <div className="grid h-56 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Daily revenue data is not available for this report.</div>;
  return <div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="rebelRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="current" stroke="#ef4444" fill="url(#rebelRevenue)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>;
}
