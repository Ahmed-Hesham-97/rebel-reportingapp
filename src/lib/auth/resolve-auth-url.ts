/**
 * Keep Auth.js URL aligned with the current host:
 * - On Vercel, a leftover localhost NEXTAUTH_URL breaks cookies on https.
 * - Locally, a production NEXTAUTH_URL redirects login to Vercel and sets
 *   Secure cookies the browser won't store on http://localhost.
 */
export function resolveAuthUrl() {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const onVercel = Boolean(process.env.VERCEL);
  const isLocalUrl = !configured || /localhost|127\.0\.0\.1/i.test(configured);

  if (onVercel && isLocalUrl) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
    if (host) {
      const url = host.startsWith("http") ? host : `https://${host}`;
      process.env.AUTH_URL = url;
      process.env.NEXTAUTH_URL = url;
      return url;
    }
  }

  if (!onVercel && configured && !isLocalUrl) {
    const port = process.env.PORT || "3000";
    const url = `http://localhost:${port}`;
    process.env.AUTH_URL = url;
    process.env.NEXTAUTH_URL = url;
    return url;
  }

  return configured;
}
