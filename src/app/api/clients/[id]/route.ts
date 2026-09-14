import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { encryptSecret } from "@/lib/security/encryption";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  shopifyStoreUrl: z.string().url(),
  shopifyAccessToken: z.string().optional(),
  klaviyoApiKey: z.string().optional(),
  metaAccessToken: z.string().optional(),
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
  if (!parsed.success) return NextResponse.json({ error: "Please check the client details." }, { status: 400 });
  const value = parsed.data;
  const update = {
    name: value.name,
    brand_logo_url: value.brandLogoUrl || null,
    shopify_store_url: value.shopifyStoreUrl,
    meta_ad_account_id: value.metaAdAccountId || null,
    report_recipients: value.reportRecipients,
    ...(value.shopifyAccessToken ? { shopify_access_token: encryptSecret(value.shopifyAccessToken) } : {}),
    ...(value.klaviyoApiKey ? { klaviyo_api_key: encryptSecret(value.klaviyoApiKey) } : {}),
    ...(value.metaAccessToken ? { meta_access_token: encryptSecret(value.metaAccessToken) } : {}),
  };
  const { error } = await supabaseAdmin().from("clients").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Unable to update client." }, { status: 500 });
  return NextResponse.json({ ok: true });
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
