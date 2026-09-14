import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { recordActivity } from "@/lib/audit";
import { renderUploadAndEmailReport } from "@/lib/reports/deliver";
import { ALL_SECTION_IDS, normalizeSections } from "@/lib/reports/sections";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({ sections: z.array(z.enum(ALL_SECTION_IDS as [string, ...string[]])).min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select at least one section to include." }, { status: 400 });
  const sections = normalizeSections(parsed.data.sections);

  const db = supabaseAdmin();
  const { data: report } = await db.from("report_snapshots").select("id,client_id,status").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status !== "completed" && report.status !== "partial") {
    return NextResponse.json({ error: "This report has no data to send yet." }, { status: 409 });
  }

  const { error: saveError } = await db.from("report_snapshots").update({ included_sections: sections }).eq("id", id);
  if (saveError) return NextResponse.json({ error: "Unable to save the section selection." }, { status: 500 });
  // Remember the choice so next month's report opens pre-checked the same way.
  await db.from("clients").update({ default_sections: sections }).eq("id", report.client_id);

  try {
    await renderUploadAndEmailReport(id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send the report." }, { status: 502 });
  }
  await recordActivity("report.delivered", { userId: user.id, clientId: report.client_id, metadata: { reportId: id, sections } });
  return NextResponse.json({ id, sections, delivered: true });
}
