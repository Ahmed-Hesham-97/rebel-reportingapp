import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { resolveAuthUrl } from "@/lib/auth/resolve-auth-url";
import { findUserByPassword } from "@/lib/auth/users";

const credentialsSchema = z.object({
  password: z.string().min(1),
});

resolveAuthUrl();

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: { password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const user = await findUserByPassword(parsed.data.password);
        if (!user) return null;
        return { id: user.id, name: user.label, role: user.role };
      },
    }),
  ],
});
