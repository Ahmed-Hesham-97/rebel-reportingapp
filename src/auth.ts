import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { isCompanyEmail } from "@/lib/auth/company-email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/security/passwords";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * On Vercel, a leftover localhost NEXTAUTH_URL makes Auth.js issue cookies that
 * the browser won't keep on https://*.vercel.app — login briefly succeeds then
 * requireUser() sends you back to /login.
 */
function resolveAuthUrl() {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const onVercel = Boolean(process.env.VERCEL);
  const isLocal = !configured || /localhost|127\.0\.0\.1/i.test(configured);
  if (onVercel && isLocal) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
    if (host) {
      const url = host.startsWith("http") ? host : `https://${host}`;
      process.env.AUTH_URL = url;
      process.env.NEXTAUTH_URL = url;
      return url;
    }
  }
  return configured;
}

resolveAuthUrl();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Required on Vercel so Auth.js trusts the Host header for callbacks/cookies.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        if (!isCompanyEmail(email)) return null;
        const { data: user, error } = await supabaseAdmin()
          .from("users")
          .select("id,email,hashed_password,role")
          .eq("email", email)
          .maybeSingle();
        if (error || !user?.hashed_password || !(await verifyPassword(parsed.data.password, user.hashed_password))) {
          return null;
        }
        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      const id = token.userId ?? token.sub ?? "";
      session.user.id = id;
      session.user.role = token.role ?? "viewer";
      return session;
    },
  },
});
