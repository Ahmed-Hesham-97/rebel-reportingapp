import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/authz";
import { getClient } from "@/lib/db";
import { authorizationUrl, createOauthState, isValidShopDomain, toShopDomain } from "@/lib/integrations/shopify-oauth";

export const runtime = "nodejs";

/**
 * Starts the OAuth handshake for a client's store. The client id travels in a
 * cookie alongside the state nonce so the callback knows which record to fill
 * without trusting anything Shopify echoes back.
 */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "A clientId is required." }, { status: 400 });
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const shop = toShopDomain(url.searchParams.get("shop") ?? client.shopify_store_url);
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "The store must be a myshopify.com domain." }, { status: 400 });
  }

  try {
    const state = createOauthState();
    const response = NextResponse.redirect(authorizationUrl(shop, state));
    const cookie = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };
    response.cookies.set("shopify_oauth_state", state, cookie);
    response.cookies.set("shopify_oauth_client", clientId, cookie);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start the install." }, { status: 500 });
  }
}
