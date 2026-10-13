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

function decryptField(payload: string | null | undefined, label: string) {
  if (!payload) return { value: null as string | null, error: null as string | null };
  try {
    return { value: decryptSecret(payload).trim(), error: null };
  } catch {
    return {
      value: null,
      error: `Could not decrypt the saved ${label}. ENCRYPTION_KEY does not match the key used when it was saved. Paste it again and Save (or Connect with Shopify again on this same environment).`,
    };
  }
}

/**
 * Shopify arrives via OAuth and Klaviyo is optional. Meta Ads is manual-only.
 * Each secret is decrypted independently so one bad key does not hide the other.
 */
export async function getClientSecrets(client: ClientRow) {
  const shopify = decryptField(client.shopify_access_token, "Shopify access token");
  const klaviyo = decryptField(client.klaviyo_api_key, "Klaviyo API key");
  return {
    shopifyToken: shopify.value,
    klaviyoApiKey: klaviyo.value,
    shopifyDecryptError: shopify.error,
    klaviyoDecryptError: klaviyo.error,
  };
}

/**
 * Per-client Dev Dashboard app credentials, falling back to global env vars so
 * existing single-app setups keep working.
 */
export function resolveShopifyAppCredentials(client: ClientRow) {
  const clientId = client.shopify_app_client_id?.trim();
  const encryptedSecret = client.shopify_app_client_secret;
  if (clientId && encryptedSecret) {
    const decrypted = decryptField(encryptedSecret, "Shopify app Client secret");
    if (decrypted.error || !decrypted.value) {
      throw new Error(
        decrypted.error ??
          "Could not decrypt this client's Shopify app secret. Paste the Client secret again and Save, then retry Connect.",
      );
    }
    return { clientId, clientSecret: decrypted.value };
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
