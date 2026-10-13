import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import type { UserRole } from "@/lib/supabase/database.types";

/** Stable handle stored in the legacy `email` column (not shown in the UI). */
export const DEFAULT_ACCESS_HANDLE = "access";

export type AppUser = {
  id: string;
  label: string;
  role: UserRole;
};

export type CreateUserResult =
  | { ok: true; user: AppUser }
  | { ok: false; code: "weak_password" | "handle_taken" | "server_error"; message: string };

function toAppUser(row: { id: string; email: string; role: UserRole }): AppUser {
  return {
    id: row.id,
    label: row.role === "admin" ? "Admin" : "Viewer",
    role: row.role,
  };
}

/** Create a password-only access account (no email login). */
export async function createPasswordUser(
  password: string,
  role: UserRole = "admin",
  handle: string = DEFAULT_ACCESS_HANDLE,
): Promise<CreateUserResult> {
  const normalized = handle.trim().toLowerCase() || DEFAULT_ACCESS_HANDLE;
  if (password.length < 12) {
    return { ok: false, code: "weak_password", message: "Password must be at least 12 characters." };
  }

  let hashed_password: string;
  try {
    hashed_password = await hashPassword(password);
  } catch {
    return { ok: false, code: "weak_password", message: "Password must be at least 12 characters." };
  }

  const db = supabaseAdmin();
  const { data: existing, error: lookupError } = await db.from("users").select("id").eq("email", normalized).maybeSingle();
  if (lookupError) {
    return { ok: false, code: "server_error", message: "Could not create account. Try again." };
  }
  if (existing) {
    return { ok: false, code: "handle_taken", message: "An access account already exists. Reset it with create-user." };
  }

  const { data: created, error: insertError } = await db
    .from("users")
    .insert({ email: normalized, hashed_password, role })
    .select("id,email,role")
    .single();

  if (insertError || !created) {
    if (insertError?.code === "23505") {
      return { ok: false, code: "handle_taken", message: "An access account already exists. Reset it with create-user." };
    }
    return { ok: false, code: "server_error", message: "Could not create account. Try again." };
  }

  return { ok: true, user: toAppUser(created) };
}

/** Upsert the primary password account (used by the create-user script). */
export async function upsertPasswordUser(password: string, role: UserRole = "admin", handle: string = DEFAULT_ACCESS_HANDLE) {
  const normalized = handle.trim().toLowerCase() || DEFAULT_ACCESS_HANDLE;
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  const hashed_password = await hashPassword(password);
  const { data, error } = await supabaseAdmin()
    .from("users")
    .upsert({ email: normalized, hashed_password, role }, { onConflict: "email" })
    .select("id,email,role")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to save password user");
  return toAppUser(data);
}

/** Match a login password against stored accounts (small team; few rows). */
export async function findUserByPassword(password: string): Promise<AppUser | null> {
  const { data: users, error } = await supabaseAdmin().from("users").select("id,email,hashed_password,role");
  if (error || !users?.length) return null;
  for (const user of users) {
    if (user.hashed_password && (await verifyPassword(password, user.hashed_password))) {
      return toAppUser(user);
    }
  }
  return null;
}
