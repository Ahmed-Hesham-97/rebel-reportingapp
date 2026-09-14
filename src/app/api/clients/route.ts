import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { encryptSecret } from "@/lib/security/encryption";
import { supabaseAdmin } from "@/lib/supabase/admin";

const clientSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  shopifyStoreUrl: z.string().url(),
  // Left blank when the store will be connected over OAuth instead.
  shopifyAccessToken: z.string().optional(),
  klaviyoApiKey: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaAdAccountId: z.string().trim().optional(),
  reportRecipients: z.array(z.string().email()).default([]),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = clientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the client details.", issues: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await supabaseAdmin().from("clients").insert({
    name: value.name,
    brand_logo_url: value.brandLogoUrl || null,
    shopify_store_url: value.shopifyStoreUrl,
    shopify_access_token: value.shopifyAccessToken ? encryptSecret(value.shopifyAccessToken) : null,
    klaviyo_api_key: value.klaviyoApiKey ? encryptSecret(value.klaviyoApiKey) : null,
    meta_access_token: value.metaAccessToken ? encryptSecret(value.metaAccessToken) : null,
    meta_ad_account_id: value.metaAdAccountId || null,
    report_recipients: value.reportRecipients,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Unable to create client." }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
