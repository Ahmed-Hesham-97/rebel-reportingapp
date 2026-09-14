import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { generateReport } from "@/lib/reports/generate-report";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({ clientId: z.string().uuid().optional(), month: z.string().regex(/^\d{4}-\d{2}-01$/) });

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A month in YYYY-MM-01 format is required." }, { status: 400 });
  try {
    if (parsed.data.clientId) return NextResponse.json(await generateReport(parsed.data.clientId, parsed.data.month, user.id));
    const { data: clients, error } = await supabaseAdmin().from("clients").select("id").eq("is_active", true);
    if (error) throw new Error("Unable to load active clients.");
    const results = await Promise.all((clients ?? []).map(async (client) => {
      try { return { clientId: client.id, ...(await generateReport(client.id, parsed.data.month, user.id)) }; }
      catch { return { clientId: client.id, status: "failed" as const, error: "Report generation failed" }; }
    }));
    return NextResponse.json({ month: parsed.data.month, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate report." }, { status: 500 });
  }
}
