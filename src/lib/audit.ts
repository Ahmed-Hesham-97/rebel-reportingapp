import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export async function recordActivity(action: string, details: { userId?: string | null; clientId?: string | null; metadata?: Json }) {
  await supabaseAdmin().from("activity_logs").insert({
    action,
    user_id: details.userId ?? null,
    client_id: details.clientId ?? null,
    metadata: details.metadata ?? {},
  });
}
