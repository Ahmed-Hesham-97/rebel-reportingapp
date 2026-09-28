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

type SavedFlags = { shopify: boolean; klaviyo: boolean; meta: boolean };

const emptyValues: ClientFormValues = {
  name: "",
  brandLogoUrl: "",
  shopifyStoreUrl: "",
  shopifyAccessToken: "",
  klaviyoApiKey: "",
  metaAccessToken: "",
  metaAdAccountId: "",
  reportRecipients: "",
};

export function ClientForm({
  clientId,
  initialValues = emptyValues,
  initialHas,
}: {
  clientId?: string;
  initialValues?: Partial<ClientFormValues>;
  initialHas?: Partial<SavedFlags>;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ ...emptyValues, ...initialValues });
  const [has, setHas] = useState<SavedFlags>({
    shopify: Boolean(initialHas?.shopify),
    klaviyo: Boolean(initialHas?.klaviyo),
    meta: Boolean(initialHas?.meta),
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const update = (key: keyof ClientFormValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function testSource(source: "shopify" | "klaviyo" | "meta") {
    setTestMessages((current) => ({ ...current, [source]: "Testing…" }));
    // Prefer testing the form value when typed; otherwise test whatever is already saved.
    const body =
      source === "shopify" && values.shopifyAccessToken.trim()
        ? { source, shopifyStoreUrl: values.shopifyStoreUrl, shopifyAccessToken: values.shopifyAccessToken }
        : source === "klaviyo" && values.klaviyoApiKey.trim()
          ? { source, klaviyoApiKey: values.klaviyoApiKey }
          : source === "meta" && values.metaAccessToken.trim()
            ? { source, metaAccessToken: values.metaAccessToken, metaAdAccountId: values.metaAdAccountId }
            : clientId
              ? null
              : { source, ...values };

    const response = await fetch(
      body ? "/api/clients/test-connection" : `/api/clients/${clientId}/test-connection`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { source }),
      },
    );
    const result = await response.json().catch(() => ({}));
    setTestMessages((current) => ({
      ...current,
      [source]: response.ok ? "Connected successfully." : (result.error ?? "Connection failed."),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const response = await fetch(clientId ? `/api/clients/${clientId}` : "/api/clients", {
      method: clientId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        reportRecipients: values.reportRecipients
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to save client.");
      return;
    }

    if (result.has) setHas(result.has);
    const saved = Array.isArray(result.savedSecrets) ? result.savedSecrets : [];
    setSuccess(
      saved.length
        ? `Saved. Updated credentials: ${saved.join(", ")}.`
        : clientId
          ? "Saved client details. No new API keys were included (leave key fields blank to keep existing ones)."
          : "Client created.",
    );
    // Clear secret inputs after a successful save so we never re-POST stale pasted values.
    setValues((current) => ({
      ...current,
      shopifyAccessToken: "",
      klaviyoApiKey: "",
      metaAccessToken: "",
    }));

    if (!clientId && result.id) {
      router.push(`/clients/${result.id}/settings`);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Client name" id="name" value={values.name} onChange={update("name")} required />
          <Field label="Brand logo URL" id="brandLogoUrl" value={values.brandLogoUrl} onChange={update("brandLogoUrl")} type="url" placeholder="https://…" />
          <Field
            label="Shopify store URL"
            id="shopifyStoreUrl"
            value={values.shopifyStoreUrl}
            onChange={update("shopifyStoreUrl")}
            type="url"
            placeholder="https://store.myshopify.com or admin.shopify.com/store/…"
            required
          />
          <Field
            label="Meta ad account ID (optional)"
            id="metaAdAccountId"
            value={values.metaAdAccountId}
            onChange={update("metaAdAccountId")}
            placeholder="act_123456789"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Private API credentials</CardTitle>
          <p className="text-sm text-slate-500">
            Paste a new key and click Save to store it encrypted. Blank fields keep the existing saved key. Prefer{" "}
            <strong>Connect with Shopify</strong> above instead of pasting a Shopify token.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <StatusLine label="Shopify token" saved={has.shopify} />
            <Field
              label="Shopify Admin access token"
              id="shopifyAccessToken"
              value={values.shopifyAccessToken}
              onChange={update("shopifyAccessToken")}
              type="password"
              autoComplete="new-password"
              placeholder={has.shopify ? "Saved — paste a new token only to replace it" : "shpat_… or use Connect with Shopify"}
            />
            <TestButton source="shopify" onClick={testSource} message={testMessages.shopify} disabled={!values.shopifyAccessToken.trim() && !has.shopify} />
          </div>
          <div>
            <StatusLine label="Klaviyo key" saved={has.klaviyo} />
            <Field
              label="Klaviyo private API key"
              id="klaviyoApiKey"
              value={values.klaviyoApiKey}
              onChange={update("klaviyoApiKey")}
              type="password"
              autoComplete="new-password"
              placeholder={has.klaviyo ? "Saved — paste a new pk_ key only to replace it" : "pk_…"}
            />
            <TestButton source="klaviyo" onClick={testSource} message={testMessages.klaviyo} disabled={!values.klaviyoApiKey.trim() && !has.klaviyo} />
          </div>
          <div>
            <StatusLine label="Meta token" saved={has.meta} />
            <Field
              label="Meta system user access token"
              id="metaAccessToken"
              value={values.metaAccessToken}
              onChange={update("metaAccessToken")}
              type="password"
              autoComplete="new-password"
              placeholder={has.meta ? "Saved — paste a new token only to replace it" : undefined}
            />
            <TestButton
              source="meta"
              onClick={testSource}
              message={testMessages.meta}
              disabled={(!values.metaAccessToken.trim() && !has.meta) || !values.metaAdAccountId.trim()}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : clientId ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}

function StatusLine({ label, saved }: { label: string; saved: boolean }) {
  return (
    <p className={`mb-2 text-xs font-semibold ${saved ? "text-emerald-700" : "text-amber-700"}`}>
      {label}: {saved ? "on file" : "not saved yet"}
    </p>
  );
}

function Field({ label, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...props} />
    </div>
  );
}

function TestButton({
  source,
  onClick,
  message,
  disabled,
}: {
  source: "shopify" | "klaviyo" | "meta";
  onClick: (source: "shopify" | "klaviyo" | "meta") => void;
  message?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => onClick(source)} disabled={disabled}>
        Test connection
      </Button>
      {message ? (
        <span role="status" className="text-xs text-slate-500">
          {message}
        </span>
      ) : null}
    </div>
  );
}
