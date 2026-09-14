"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectionTest({ clientId, source }: { clientId: string; source: "shopify" | "klaviyo" | "meta" }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function test() {
    setPending(true); setMessage("");
    const response = await fetch(`/api/clients/${clientId}/test-connection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    setMessage(response.ok ? "Connected successfully." : body.error ?? "Connection failed.");
  }
  return <div className="flex items-center gap-3"><Button type="button" variant="outline" size="sm" onClick={test} disabled={pending}>{pending ? "Testing…" : "Test connection"}</Button>{message && <span role="status" className="text-xs text-slate-500">{message}</span>}</div>;
}
