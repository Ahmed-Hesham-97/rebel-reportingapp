import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(20),
  ENCRYPTION_KEY: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  // Only needed to connect stores over OAuth; absent until the Dev Dashboard app exists.
  // Empty strings from .env.local count as unset (Zod optional only skips undefined).
  SHOPIFY_CLIENT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  SHOPIFY_CLIENT_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    // Prefer the real deployment URL over a localhost value copied into Vercel.
    // Locally, prefer localhost over a production URL copied into .env.
    const configured = process.env.NEXTAUTH_URL ?? "";
    const isLocalUrl = !configured || /localhost|127\.0\.0\.1/i.test(configured);
    if (process.env.VERCEL && isLocalUrl) {
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
      if (host) process.env.NEXTAUTH_URL = host.startsWith("http") ? host : `https://${host}`;
    } else if (!process.env.VERCEL && configured && !isLocalUrl) {
      process.env.NEXTAUTH_URL = `http://localhost:${process.env.PORT || "3000"}`;
    }
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

export type ShopifyAppCredentials = { clientId: string; clientSecret: string };

/** Global fallback from env. Prefer per-client credentials via resolveShopifyAppCredentials. */
export function getShopifyAppCredentials(): ShopifyAppCredentials {
  const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = getEnv();
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "Set this client's Shopify app Client ID and secret in settings, or set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.",
    );
  }
  return { clientId: SHOPIFY_CLIENT_ID, clientSecret: SHOPIFY_CLIENT_SECRET };
}

export function tryGetShopifyAppCredentials(): ShopifyAppCredentials | null {
  const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = getEnv();
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) return null;
  return { clientId: SHOPIFY_CLIENT_ID, clientSecret: SHOPIFY_CLIENT_SECRET };
}
