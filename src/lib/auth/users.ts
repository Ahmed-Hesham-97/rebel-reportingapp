import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isCompanyEmail } from "@/lib/auth/company-email";
import { hashPassword } from "@/lib/security/passwords";
import type { UserRole } from "@/lib/supabase/database.types";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type CreateUserResult =
  | { ok: true; user: AppUser }
  | { ok: false; code: "invalid_email" | "weak_password" | "email_taken" | "server_error"; message: string };

/** Create a password account for a company email only. */
export async function createCompanyUser(email: string, password: string, role: UserRole = "admin"): Promise<CreateUserResult> {
  const normalized = email.trim().toLowerCase();
  if (!isCompanyEmail(normalized)) {
    return { ok: false, code: "invalid_email", message: "Use your @rebelmarketingcafe.com work email." };
  }
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
    return { ok: false, code: "email_taken", message: "An account with this email already exists." };
  }

  const { data: created, error: insertError } = await db
    .from("users")
    .insert({ email: normalized, hashed_password, role })
    .select("id,email,role")
    .single();

  if (insertError || !created) {
    if (insertError?.code === "23505") {
      return { ok: false, code: "email_taken", message: "An account with this email already exists." };
    }
    return { ok: false, code: "server_error", message: "Could not create account. Try again." };
  }

  return { ok: true, user: created };
}
