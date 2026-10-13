import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getClient, hasShopifyAppCredentials } from "@/lib/db";
import { ClientForm } from "@/components/clients/client-form";
import { ConnectionTest } from "@/components/clients/connection-test";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FLASH: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  shopify: { tone: "ok", text: "Shopify connected. You can generate reports for this store now." },
  shopify_hmac: {
    tone: "err",
    text: "Shopify rejected the callback signature. Confirm this client's Shopify app Client secret matches the Dev Dashboard app.",
  },
  shopify_shop: { tone: "err", text: "Shopify returned an invalid shop domain." },
  shopify_code: { tone: "err", text: "Shopify did not return an authorization code. Try connecting again." },
  shopify_credentials: {
    tone: "err",
    text: "Shopify app credentials are missing for this client. Save the Client ID and Client secret from the Dev Dashboard, then try Connect again.",
  },
  shopify_exchange: {
    tone: "err",
    text: "Shopify connect failed (token exchange or save). Confirm this client's Shopify app Client ID / secret match the Dev Dashboard app, then try Connect again.",
  },
  shopify_state: { tone: "err", text: "The Shopify connection expired. Click Connect with Shopify again." },
};

export default async function ClientSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();

  const canConnect = hasShopifyAppCredentials(client);
  const errorKey = typeof query.error === "string" ? query.error : undefined;
  const connectedKey = typeof query.connected === "string" ? query.connected : undefined;
  const warning = typeof query.warning === "string" ? query.warning : undefined;
  const flash =
    (errorKey && FLASH[errorKey]) ||
    (connectedKey && FLASH[connectedKey]) ||
    (warning?.startsWith("missing_scopes:")
      ? { tone: "warn" as const, text: `Connected, but Shopify did not grant: ${warning.slice("missing_scopes:".length)}` }
      : undefined);
  const flashClass =
    flash?.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : flash?.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href={`/clients/${id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to client
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Client settings</h1>
        <p className="mb-8 mt-2 text-slate-500">
          Update connection details for {client.name}. Existing secrets stay unchanged unless replaced. Meta Ads metrics are entered manually on each report.
        </p>
        {flash ? <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${flashClass}`}>{flash.text}</div> : null}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Connect the Shopify store</CardTitle>
            <p className="text-sm text-slate-500">
              1) Create a Custom-distribution app for this store in the Shopify Dev Dashboard. 2) Save that app&apos;s Client ID
              and Client secret below. 3) Click Connect to approve scopes and store a fresh Admin API token.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {canConnect ? (
              <Button asChild>
                <a href={`/api/shopify/install?clientId=${client.id}`}>Connect with Shopify</a>
              </Button>
            ) : (
              <Button type="button" disabled>
                Connect with Shopify
              </Button>
            )}
            {client.shopify_access_token ? (
              <span className="text-xs text-slate-500">A token is saved — reconnect if reports fail with auth errors.</span>
            ) : canConnect ? (
              <span className="text-xs font-medium text-amber-700">App credentials saved — not connected yet.</span>
            ) : (
              <span className="text-xs font-medium text-amber-700">Save Shopify app Client ID + secret below first.</span>
            )}
          </CardContent>
        </Card>
        <ClientForm
          clientId={client.id}
          initialValues={{
            name: client.name,
            brandLogoUrl: client.brand_logo_url ?? "",
            shopifyStoreUrl: client.shopify_store_url,
            shopifyAppClientId: client.shopify_app_client_id ?? "",
            reportRecipients: client.report_recipients.join(", "),
          }}
          initialHas={{
            shopify: Boolean(client.shopify_access_token),
            shopifyApp: Boolean(client.shopify_app_client_id && client.shopify_app_client_secret),
            klaviyo: Boolean(client.klaviyo_api_key),
          }}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ConnectionTest clientId={client.id} source="shopify" />
          <ConnectionTest clientId={client.id} source="klaviyo" />
        </div>
      </div>
    </div>
  );
}
