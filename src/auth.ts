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

export const { handlers, signIn, signOut, auth } = NextAuth({
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
      if (user?.id) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId ?? token.sub ?? "";
      session.user.role = token.role ?? "viewer";
      return session;
    },
  },
});
