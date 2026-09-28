"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ShopifyMetrics } from "@/types/report";
import { formatCurrency } from "@/lib/utils";

function shortDate(value: string) {
  const day = value.slice(8, 10);
  const month = value.slice(5, 7);
  return `${month}/${day}`;
}

export function RevenueChart({ data }: { data: ShopifyMetrics["dailyRevenue"] }) {
  if (!data.length) {
    return (
      <div className="grid h-64 place-items-center rounded-2xl bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
        Daily revenue data is not available for this report. Regenerate it after connecting Shopify with sales access.
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    label: shortDate(point.date),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rebelRevenueCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rebelRevenuePrevious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(15,23,42,0.06)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(value: number) => formatCurrency(value)}
            width={64}
          />
          <Tooltip
            formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value))}
            labelFormatter={(label) => `Day ${label}`}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
              fontSize: 12,
            }}
          />
          <Legend />
          <Area type="monotone" dataKey="previous" name="Previous month" stroke="#94a3b8" fill="url(#rebelRevenuePrevious)" strokeWidth={2} />
          <Area type="monotone" dataKey="current" name="This month" stroke="#e11d48" fill="url(#rebelRevenueCurrent)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
