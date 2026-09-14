import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { getClient, getClientSecrets } from "@/lib/db";
import { testShopifyConnection } from "@/lib/integrations/shopify";
import { testKlaviyoConnection } from "@/lib/integrations/klaviyo";
import { testMetaConnection } from "@/lib/integrations/meta";

const schema = z.object({ source: z.enum(["shopify", "klaviyo", "meta"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid data source." }, { status: 400 });
  try {
    const secrets = await getClientSecrets(client);
    if (parsed.data.source === "shopify") {
      if (!secrets.shopifyToken) return NextResponse.json({ ok: false, error: "This store is not connected yet." }, { status: 400 });
      const result = await testShopifyConnection(client.shopify_store_url, secrets.shopifyToken);
      return NextResponse.json({ ok: true, source: "shopify", result });
    }
    if (parsed.data.source === "klaviyo") {
      if (!secrets.klaviyoApiKey) return NextResponse.json({ ok: false, error: "No Klaviyo API key is saved for this client." }, { status: 400 });
      const result = await testKlaviyoConnection(secrets.klaviyoApiKey);
      return NextResponse.json({ ok: true, source: "klaviyo", result });
    }
    if (!secrets.metaAccessToken || !client.meta_ad_account_id) {
      return NextResponse.json({ ok: false, error: "No Meta token and ad account are saved for this client." }, { status: 400 });
    }
    const result = await testMetaConnection(secrets.metaAccessToken, client.meta_ad_account_id);
    return NextResponse.json({ ok: true, source: "meta", result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Connection failed." }, { status: 502 });
  }
}
