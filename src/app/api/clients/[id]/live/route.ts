import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/authz";
import { getClient, getClientSecrets } from "@/lib/db";
import { testShopifyConnection, fetchShopifyMetrics } from "@/lib/integrations/shopify";
import { fetchKlaviyoMetrics } from "@/lib/integrations/klaviyo";
import { fetchMetaMetrics } from "@/lib/integrations/meta";
import { getPreviousMonthPeriod } from "@/lib/reports/date-range";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getApiUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const secrets = await getClientSecrets(client);
  const shopifyToken = secrets.shopifyToken;
  if (!shopifyToken) return NextResponse.json({ error: "Connect the Shopify store first." }, { status: 409 });
  const shop = await testShopifyConnection(client.shopify_store_url, shopifyToken).catch(() => ({ timezone: "UTC" }));
  const period = getPreviousMonthPeriod(new Date(), shop.timezone);
  const klaviyoKey = secrets.klaviyoApiKey;
  const metaToken = secrets.metaAccessToken;
  const metaAccount = client.meta_ad_account_id;
  const [shopify, klaviyo, meta] = await Promise.allSettled([
    fetchShopifyMetrics(client.shopify_store_url, shopifyToken, period),
    klaviyoKey ? fetchKlaviyoMetrics(klaviyoKey, period) : Promise.resolve(null),
    metaToken && metaAccount ? fetchMetaMetrics(metaToken, metaAccount, period) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    period,
    shopify: shopify.status === "fulfilled" ? shopify.value : null,
    klaviyo: klaviyo.status === "fulfilled" ? klaviyo.value : null,
    meta: meta.status === "fulfilled" ? meta.value : null,
  });
}
