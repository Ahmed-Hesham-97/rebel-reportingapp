import type { NextAuthConfig } from "next-auth";

/** Edge-safe Auth.js config (no Supabase / Node crypto). Providers are added in auth.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user?.id);

      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/shopify/callback") ||
        pathname.startsWith("/api/cron");

      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.userId = user.id;
        token.role = user.role ?? "viewer";
        // Marks sessions created after password-only auth; rejects older cookies.
        token.authVersion = 2;
      }
      return token;
    },
    session({ session, token }) {
      if (token.authVersion !== 2 || !token.userId) {
        session.user.id = "";
        session.user.role = "viewer";
        return session;
      }
      session.user.id = token.userId;
      session.user.role = token.role ?? "viewer";
      return session;
    },
  },
} satisfies NextAuthConfig;
