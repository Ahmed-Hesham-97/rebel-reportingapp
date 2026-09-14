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
  SHOPIFY_CLIENT_ID: z.string().min(1).optional(),
  SHOPIFY_CLIENT_SECRET: z.string().min(1).optional(),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    // Prefer the real deployment URL over a localhost value copied into Vercel.
    if (process.env.VERCEL) {
      const configured = process.env.NEXTAUTH_URL ?? "";
      if (!configured || /localhost|127\.0\.0\.1/i.test(configured)) {
        const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
        if (host) process.env.NEXTAUTH_URL = host.startsWith("http") ? host : `https://${host}`;
      }
    }
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

export function getShopifyAppCredentials() {
  const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = getEnv();
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET to connect stores over OAuth.");
  }
  return { clientId: SHOPIFY_CLIENT_ID, clientSecret: SHOPIFY_CLIENT_SECRET };
}
