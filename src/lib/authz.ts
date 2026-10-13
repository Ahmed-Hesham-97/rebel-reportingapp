import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
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
  const session = await auth();
  return session?.user ?? null;
}
