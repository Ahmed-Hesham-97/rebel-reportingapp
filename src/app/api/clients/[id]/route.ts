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

/** Empty / whitespace means "leave existing secret unchanged". */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : undefined;
  });

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  shopifyStoreUrl: shopifyStoreUrlSchema,
  shopifyAccessToken: optionalSecret,
  klaviyoApiKey: optionalSecret,
  metaAccessToken: optionalSecret,
  metaAdAccountId: z.string().trim().optional(),
  reportRecipients: z.array(z.string().email()).default([]),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the client details.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const value = parsed.data;
  const savedSecrets: string[] = [];

  const update: {
    name: string;
    brand_logo_url: string | null;
    shopify_store_url: string;
    meta_ad_account_id: string | null;
    report_recipients: string[];
    shopify_access_token?: string;
    klaviyo_api_key?: string;
    meta_access_token?: string;
  } = {
    name: value.name,
    brand_logo_url: value.brandLogoUrl || null,
    shopify_store_url: value.shopifyStoreUrl,
    meta_ad_account_id: value.metaAdAccountId || null,
    report_recipients: value.reportRecipients,
  };

  if (value.shopifyAccessToken) {
    update.shopify_access_token = encryptSecret(value.shopifyAccessToken);
    savedSecrets.push("shopify");
  }
  if (value.klaviyoApiKey) {
    update.klaviyo_api_key = encryptSecret(value.klaviyoApiKey);
    savedSecrets.push("klaviyo");
  }
  if (value.metaAccessToken) {
    update.meta_access_token = encryptSecret(value.metaAccessToken);
    savedSecrets.push("meta");
  }

  const { data, error } = await supabaseAdmin()
    .from("clients")
    .update(update)
    .eq("id", id)
    .select("id,shopify_access_token,klaviyo_api_key,meta_access_token,meta_ad_account_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: `Unable to update client: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Client not found — nothing was saved." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    savedSecrets,
    has: {
      shopify: Boolean(data.shopify_access_token),
      klaviyo: Boolean(data.klaviyo_api_key),
      meta: Boolean(data.meta_access_token && data.meta_ad_account_id),
    },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { error } = await supabaseAdmin().from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Unable to delete client." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
