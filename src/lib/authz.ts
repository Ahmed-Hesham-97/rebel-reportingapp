import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Temporary open access while Shopify OAuth / onboarding is being finished.
 * Set to `false` (and redeploy) to restore login + role checks.
 */
export const AUTH_DISABLED = true;

const OPEN_ACCESS_USER = {
  id: "open-access",
  email: "open-access@local",
  name: "Open access",
  image: null,
  role: "admin" as const,
};

export async function requireUser() {
  if (AUTH_DISABLED) return OPEN_ACCESS_USER;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard?error=forbidden");
  return user;
}

export async function getApiUser() {
  if (AUTH_DISABLED) return OPEN_ACCESS_USER;
  const session = await auth();
  return session?.user ?? null;
}
