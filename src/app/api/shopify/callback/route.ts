import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { encryptSecret } from "@/lib/security/encryption";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { testShopifyConnection } from "@/lib/integrations/shopify";
import {
  exchangeCodeForToken,
  isValidShopDomain,
  parseOauthState,
  verifyCallbackHmac,
} from "@/lib/integrations/shopify-oauth";

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
  const parsed = parseOauthState(state);

  if (!parsed) {
    return backTo("/dashboard", { error: "shopify_state" });
  }
  const { clientId } = parsed;
  if (!verifyCallbackHmac(url)) return backTo(`/clients/${clientId}/settings`, { error: "shopify_hmac" });
  if (!isValidShopDomain(shop)) return backTo(`/clients/${clientId}/settings`, { error: "shopify_shop" });
  if (!code) return backTo(`/clients/${clientId}/settings`, { error: "shopify_code" });

  try {
    const { accessToken, missing } = await exchangeCodeForToken(shop, code);
    // Prove the token works before we claim the store is connected.
    await testShopifyConnection(`https://${shop}`, accessToken);

    const encrypted = encryptSecret(accessToken);
    const { data, error } = await supabaseAdmin()
      .from("clients")
      .update({ shopify_store_url: `https://${shop}`, shopify_access_token: encrypted })
      .eq("id", clientId)
      .select("id,shopify_access_token")
      .maybeSingle();

    if (error) {
      logger.error({ err: error, clientId, shop }, "shopify token save failed");
      throw new Error(`Unable to save the Shopify token: ${error.message}`);
    }
    if (!data?.shopify_access_token) {
      throw new Error("Shopify token update matched no client row.");
    }

    await recordActivity("client.shopify_connected", { clientId, metadata: { shop, missingScopes: missing } });
    return backTo(
      `/clients/${clientId}/settings`,
      missing.length ? { warning: `missing_scopes:${missing.join(",")}` } : { connected: "shopify" },
    );
  } catch (error) {
    logger.error({ err: error, shop, clientId }, "shopify oauth callback failed");
    return backTo(`/clients/${clientId}/settings`, { error: "shopify_exchange" });
  }
}
