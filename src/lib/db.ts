import "server-only";

import { getShopifyAppCredentials, tryGetShopifyAppCredentials } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";
import type { Database } from "@/lib/supabase/database.types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export async function getClient(id: string) {
  const { data, error } = await supabaseAdmin().from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load client");
  return data;
}

/**
 * Shopify arrives via OAuth and Klaviyo is optional. Meta Ads is manual-only.
 */
export async function getClientSecrets(client: ClientRow) {
  try {
    return {
      shopifyToken: client.shopify_access_token ? decryptSecret(client.shopify_access_token).trim() : null,
      klaviyoApiKey: client.klaviyo_api_key ? decryptSecret(client.klaviyo_api_key).trim() : null,
    };
  } catch {
    throw new Error(
      "Could not decrypt saved API keys. ENCRYPTION_KEY may not match the key used when they were saved. Paste the keys again and Save.",
    );
  }
}

/**
 * Per-client Dev Dashboard app credentials, falling back to global env vars so
 * existing single-app setups keep working.
 */
export function resolveShopifyAppCredentials(client: ClientRow) {
  const clientId = client.shopify_app_client_id?.trim();
  const encryptedSecret = client.shopify_app_client_secret;
  if (clientId && encryptedSecret) {
    try {
      return { clientId, clientSecret: decryptSecret(encryptedSecret).trim() };
    } catch {
      throw new Error(
        "Could not decrypt this client's Shopify app secret. ENCRYPTION_KEY may not match the key used when it was saved. Paste the Client secret again and Save, then retry Connect.",
      );
    }
  }
  return getShopifyAppCredentials();
}

export function hasShopifyAppCredentials(client: ClientRow) {
  if (client.shopify_app_client_id?.trim() && client.shopify_app_client_secret) return true;
  return Boolean(tryGetShopifyAppCredentials());
}

export function configuredSources(client: ClientRow) {
  return {
    shopify: Boolean(client.shopify_access_token),
    klaviyo: Boolean(client.klaviyo_api_key),
    // Meta Ads is always manual — never treated as an API-linked source.
    meta: false,
  };
}

export async function listClients() {
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .select("id,name,brand_logo_url,shopify_store_url,report_recipients,is_active,created_at")
    .order("name");
  if (error) throw new Error("Unable to load clients");
  return data;
}
