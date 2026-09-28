import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Drop non-UUID actor ids (e.g. open-access bypass) so the users FK stays happy. */
function asUserId(value?: string | null) {
  return value && UUID.test(value) ? value : null;
}

export async function recordActivity(action: string, details: { userId?: string | null; clientId?: string | null; metadata?: Json }) {
  await supabaseAdmin().from("activity_logs").insert({
    action,
    user_id: asUserId(details.userId),
    client_id: details.clientId ?? null,
    metadata: details.metadata ?? {},
  });
}
