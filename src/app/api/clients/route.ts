import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { isValidShopDomain, toShopDomain, toShopifyStoreUrl } from "@/lib/integrations/shopify-oauth";
import { encryptSecret } from "@/lib/security/encryption";
import { supabaseAdmin } from "@/lib/supabase/admin";

const shopifyStoreUrlSchema = z.string().trim().min(1).transform((value, ctx) => {
  const domain = toShopDomain(value);
  if (!isValidShopDomain(domain)) {
    ctx.addIssue({ code: "custom", message: "Use a myshopify.com URL or an admin.shopify.com/store/… link." });
    return z.NEVER;
  }
  return toShopifyStoreUrl(value);
});

const clientSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  shopifyStoreUrl: shopifyStoreUrlSchema,
  shopifyAccessToken: z.string().optional(),
  klaviyoApiKey: z.string().optional(),
  reportRecipients: z.array(z.string().email()).default([]),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = clientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the client details.", issues: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .insert({
      name: value.name,
      brand_logo_url: value.brandLogoUrl || null,
      shopify_store_url: value.shopifyStoreUrl,
      shopify_access_token: value.shopifyAccessToken?.trim() ? encryptSecret(value.shopifyAccessToken.trim()) : null,
      klaviyo_api_key: value.klaviyoApiKey?.trim() ? encryptSecret(value.klaviyoApiKey.trim()) : null,
      meta_access_token: null,
      meta_ad_account_id: null,
      report_recipients: value.reportRecipients,
    })
    .select("id,shopify_access_token,klaviyo_api_key")
    .single();
  if (error) return NextResponse.json({ error: `Unable to create client: ${error.message}` }, { status: 500 });
  return NextResponse.json(
    {
      id: data.id,
      savedSecrets: [data.shopify_access_token ? "shopify" : null, data.klaviyo_api_key ? "klaviyo" : null].filter(Boolean),
      has: {
        shopify: Boolean(data.shopify_access_token),
        klaviyo: Boolean(data.klaviyo_api_key),
      },
    },
    { status: 201 },
  );
}
