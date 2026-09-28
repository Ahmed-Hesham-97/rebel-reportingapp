import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getEnv, getShopifyAppCredentials } from "@/lib/env";

/**
 * Scopes the report needs. read_reports powers the storefront funnel and
 * read_themes the live theme status; both are optional to the merchant but
 * requested together so a single install covers the whole report.
 */
export const SHOPIFY_SCOPES = ["read_orders", "read_products", "read_reports", "read_themes"] as const;

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const ADMIN_STORE = /(?:https?:\/\/)?admin\.shopify\.com\/store\/([a-zA-Z0-9][a-zA-Z0-9-]*)/i;
const BARE_HANDLE = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

export function isValidShopDomain(shop: string | null): shop is string {
  return typeof shop === "string" && SHOP_DOMAIN.test(shop);
}

/**
 * Accepts myshopify URLs, admin.shopify.com/store/{handle} links, or bare
 * handles and returns the `{handle}.myshopify.com` hostname Admin API needs.
 */
export function toShopDomain(input: string) {
  const trimmed = input.trim();
  const admin = trimmed.match(ADMIN_STORE);
  if (admin) return `${admin[1].toLowerCase()}.myshopify.com`;

  const host = trimmed.replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase() ?? "";
  if (SHOP_DOMAIN.test(host)) return host;
  if (BARE_HANDLE.test(host)) return `${host}.myshopify.com`;
  return host;
}

export function toShopifyStoreUrl(input: string) {
  return `https://${toShopDomain(input)}`;
}

export function redirectUri() {
  return new URL("/api/shopify/callback", getEnv().NEXTAUTH_URL).toString();
}

export function createOauthState() {
  return randomBytes(16).toString("hex");
}

export function authorizationUrl(shop: string, state: string) {
  const { clientId } = getShopifyAppCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES.join(","),
    redirect_uri: redirectUri(),
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verifies the callback signature: drop `hmac`, sort the remaining query
 * parameters, and compare a SHA-256 digest in constant time.
 */
export function verifyCallbackHmac(url: URL) {
  const { clientSecret } = getShopifyAppCredentials();
  const provided = url.searchParams.get("hmac");
  if (!provided) return false;
  const message = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hmac")
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = Buffer.from(createHmac("sha256", clientSecret).update(message).digest("hex"));
  const expected = Buffer.from(provided);
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

type TokenResponse = { access_token: string; scope: string };

/**
 * Exchanges the authorization code for a non-expiring offline token. Custom
 * apps are exempt from the 2027 expiring-token requirement, so no refresh
 * bookkeeping is needed for agency-installed apps.
 */
export async function exchangeCodeForToken(shop: string, code: string) {
  const { clientId, clientSecret } = getShopifyAppCredentials();
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!response.ok) throw new Error("Shopify rejected the authorization code.");
  const { access_token, scope } = (await response.json()) as TokenResponse;
  const granted = scope.split(",");
  const missing = SHOPIFY_SCOPES.filter((needed) => !granted.includes(needed));
  return { accessToken: access_token, granted, missing };
}
