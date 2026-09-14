import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { testShopifyConnection } from "@/lib/integrations/shopify";
import { testKlaviyoConnection } from "@/lib/integrations/klaviyo";
import { testMetaConnection } from "@/lib/integrations/meta";

const schema = z.object({
  source: z.enum(["shopify", "klaviyo", "meta"]),
  shopifyStoreUrl: z.string().url().optional(),
  shopifyAccessToken: z.string().optional(),
  klaviyoApiKey: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaAdAccountId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Connection details are incomplete." }, { status: 400 });
  const value = parsed.data;
  try {
    const result = value.source === "shopify"
      ? await testShopifyConnection(value.shopifyStoreUrl ?? "", value.shopifyAccessToken ?? "")
      : value.source === "klaviyo"
        ? await testKlaviyoConnection(value.klaviyoApiKey ?? "")
        : await testMetaConnection(value.metaAccessToken ?? "", value.metaAdAccountId ?? "");
    return NextResponse.json({ ok: true, source: value.source, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Connection failed." }, { status: 502 });
  }
}
