import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateReport } from "@/lib/reports/generate-report";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${getEnv().CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: clients, error } = await supabaseAdmin().from("clients").select("id").eq("is_active", true);
  if (error) return NextResponse.json({ error: "Unable to load active clients." }, { status: 500 });
  const monthDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));
  const month = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  // Cron only collects data. Reports wait in review until a team member picks
  // sections and sends them, so nothing reaches a client unreviewed.
  const results = await Promise.all((clients ?? []).map(async (client) => {
    try { return { clientId: client.id, ...(await generateReport(client.id, month)) }; }
    catch (reportError) { logger.error({ clientId: client.id, error: reportError }, "cron report failed"); return { clientId: client.id, status: "failed", error: "Report generation failed" }; }
  }));
  return NextResponse.json({ month, results });
}
