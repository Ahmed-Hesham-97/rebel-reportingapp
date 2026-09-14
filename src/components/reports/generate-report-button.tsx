"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function generate() {
    setPending(true); setMessage("");
    const date = new Date();
    const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
    const month = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const response = await fetch("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, month }) });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    setMessage(response.ok ? `Report ${body.status}.` : body.error ?? "Unable to generate report.");
    if (response.ok) window.location.reload();
  }
  return <div className="flex items-center gap-3"><Button onClick={generate} disabled={pending}>{pending ? "Generating…" : "Generate latest report"}</Button>{message && <span role="status" className="text-xs text-slate-500">{message}</span>}</div>;
}
