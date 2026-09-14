import "server-only";

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
 * Shopify arrives via OAuth and Klaviyo/Meta are optional, so any of these can
 * be absent on a freshly created client.
 */
export async function getClientSecrets(client: ClientRow) {
  return {
    shopifyToken: client.shopify_access_token ? decryptSecret(client.shopify_access_token) : null,
    klaviyoApiKey: client.klaviyo_api_key ? decryptSecret(client.klaviyo_api_key) : null,
    metaAccessToken: client.meta_access_token ? decryptSecret(client.meta_access_token) : null,
  };
}

export function configuredSources(client: ClientRow) {
  return {
    shopify: Boolean(client.shopify_access_token),
    klaviyo: Boolean(client.klaviyo_api_key),
    meta: Boolean(client.meta_access_token && client.meta_ad_account_id),
  };
}

export async function listClients() {
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .select("id,name,brand_logo_url,shopify_store_url,meta_ad_account_id,report_recipients,is_active,created_at")
    .order("name");
  if (error) throw new Error("Unable to load clients");
  return data;
}
