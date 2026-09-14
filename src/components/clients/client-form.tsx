"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClientFormValues = {
  name: string;
  brandLogoUrl: string;
  shopifyStoreUrl: string;
  shopifyAccessToken: string;
  klaviyoApiKey: string;
  metaAccessToken: string;
  metaAdAccountId: string;
  reportRecipients: string;
};

const emptyValues: ClientFormValues = { name: "", brandLogoUrl: "", shopifyStoreUrl: "", shopifyAccessToken: "", klaviyoApiKey: "", metaAccessToken: "", metaAdAccountId: "", reportRecipients: "" };

export function ClientForm({ clientId, initialValues = emptyValues }: { clientId?: string; initialValues?: Partial<ClientFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState({ ...emptyValues, ...initialValues });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const update = (key: keyof ClientFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));

  async function testSource(source: "shopify" | "klaviyo" | "meta") {
    setTestMessages((current) => ({ ...current, [source]: "Testing…" }));
    const response = await fetch("/api/clients/test-connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, ...values }) });
    const result = await response.json().catch(() => ({}));
    setTestMessages((current) => ({ ...current, [source]: response.ok ? "Connected successfully." : result.error ?? "Connection failed." }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const response = await fetch(clientId ? `/api/clients/${clientId}` : "/api/clients", { method: clientId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, reportRecipients: values.reportRecipients.split(",").map((email) => email.trim()).filter(Boolean) }) });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) { setError(result.error ?? "Unable to save client."); return; }
    router.push(clientId ? `/clients/${clientId}` : `/clients/${result.id}`);
    router.refresh();
  }

  return <form onSubmit={submit} className="space-y-6">
    <Card><CardHeader><CardTitle>Client details</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <Field label="Client name" id="name" value={values.name} onChange={update("name")} required />
      <Field label="Brand logo URL" id="brandLogoUrl" value={values.brandLogoUrl} onChange={update("brandLogoUrl")} type="url" placeholder="https://…" />
      <Field label="Shopify store URL" id="shopifyStoreUrl" value={values.shopifyStoreUrl} onChange={update("shopifyStoreUrl")} type="url" placeholder="https://store.myshopify.com" required />
      <Field label="Meta ad account ID (optional)" id="metaAdAccountId" value={values.metaAdAccountId} onChange={update("metaAdAccountId")} placeholder="act_123456789" />
      <Field label="Report recipients" id="reportRecipients" value={values.reportRecipients} onChange={update("reportRecipients")} placeholder="client@example.com, owner@example.com" />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Private API credentials</CardTitle><p className="text-sm text-slate-500">Credentials are encrypted before they are stored and never sent to the browser. Only Shopify is required — add Klaviyo and Meta whenever you have them, and their report sections stay hidden until you do.</p></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <div><Field label="Shopify Admin access token" id="shopifyAccessToken" value={values.shopifyAccessToken} onChange={update("shopifyAccessToken")} type="password" required={!clientId} placeholder={clientId ? "Leave unchanged to keep current token" : "shpat_…"} /><TestButton source="shopify" onClick={testSource} message={testMessages.shopify} disabled={!values.shopifyAccessToken} /></div>
      <div><Field label="Klaviyo private API key (optional)" id="klaviyoApiKey" value={values.klaviyoApiKey} onChange={update("klaviyoApiKey")} type="password" placeholder={clientId ? "Leave unchanged to keep current key" : "pk_…"} /><TestButton source="klaviyo" onClick={testSource} message={testMessages.klaviyo} disabled={!values.klaviyoApiKey} /></div>
      <div><Field label="Meta system user access token (optional)" id="metaAccessToken" value={values.metaAccessToken} onChange={update("metaAccessToken")} type="password" placeholder={clientId ? "Leave unchanged to keep current token" : undefined} /><TestButton source="meta" onClick={testSource} message={testMessages.meta} disabled={!values.metaAccessToken || !values.metaAdAccountId} /></div>
    </CardContent></Card>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : clientId ? "Save changes" : "Create client"}</Button></div>
  </form>;
}

function Field({ label, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} {...props} /></div>;
}

function TestButton({ source, onClick, message, disabled }: { source: "shopify" | "klaviyo" | "meta"; onClick: (source: "shopify" | "klaviyo" | "meta") => void; message?: string; disabled?: boolean }) {
  return <div className="mt-2 flex items-center gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => onClick(source)} disabled={disabled}>Test connection</Button>{message && <span role="status" className="text-xs text-slate-500">{message}</span>}</div>;
}
