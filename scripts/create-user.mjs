import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const scrypt = promisify(scryptCallback);

const [email, password, role = "admin"] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node --env-file=.env scripts/create-user.mjs <email> <password> [admin|viewer]');
  process.exit(1);
}

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derived = await scrypt(password, salt, 64);
const hashed_password = `scrypt$${salt}$${derived.toString("hex")}`;

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data, error } = await supabase
  .from("users")
  .upsert({ email: email.toLowerCase(), hashed_password, role }, { onConflict: "email" })
  .select("id,email,role")
  .single();

if (error) {
  console.error("Failed to create user:", error.message);
  process.exit(1);
}

console.log(`Created ${data.role} user ${data.email}`);
