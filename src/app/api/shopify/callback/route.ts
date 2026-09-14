import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordActivity } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { encryptSecret } from "@/lib/security/encryption";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForToken, isValidShopDomain, verifyCallbackHmac } from "@/lib/integrations/shopify-oauth";

export const runtime = "nodejs";

function backTo(path: string, params: Record<string, string>) {
  const url = new URL(path, getEnv().NEXTAUTH_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get("shopify_oauth_state")?.value;
  const clientId = jar.get("shopify_oauth_client")?.value;

  // Order matters: prove the request is ours and untampered before spending the code.
  if (!state || !expectedState || state !== expectedState || !clientId) {
    return backTo("/dashboard", { error: "shopify_state" });
  }
  if (!verifyCallbackHmac(url)) return backTo(`/clients/${clientId}`, { error: "shopify_hmac" });
  if (!isValidShopDomain(shop)) return backTo(`/clients/${clientId}`, { error: "shopify_shop" });
  if (!code) return backTo(`/clients/${clientId}`, { error: "shopify_code" });

  try {
    const { accessToken, missing } = await exchangeCodeForToken(shop, code);
    const { error } = await supabaseAdmin()
      .from("clients")
      .update({ shopify_store_url: `https://${shop}`, shopify_access_token: encryptSecret(accessToken) })
      .eq("id", clientId);
    if (error) throw new Error("Unable to save the Shopify token.");
    await recordActivity("client.shopify_connected", { clientId, metadata: { shop, missingScopes: missing } });
    const response = backTo(`/clients/${clientId}`, missing.length ? { warning: `missing_scopes:${missing.join(",")}` } : { connected: "shopify" });
    response.cookies.delete("shopify_oauth_state");
    response.cookies.delete("shopify_oauth_client");
    return response;
  } catch (error) {
    logger.error({ err: error, shop }, "shopify oauth callback failed");
    return backTo(`/clients/${clientId}`, { error: "shopify_exchange" });
  }
}
