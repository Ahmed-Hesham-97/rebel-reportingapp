import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/authz";
import { recordActivity } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from("report_snapshots")
    .select("id,client_id,report_month,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load report." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({
    id: data.id,
    clientId: data.client_id,
    reportMonth: data.report_month,
    shopify: data.shopify_data,
    klaviyo: data.klaviyo_data,
    meta: data.meta_data,
    pdfUrl: data.pdf_url,
    status: data.status,
    errorLog: data.error_log,
    createdAt: data.created_at,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: existing, error: lookupError } = await supabaseAdmin()
    .from("report_snapshots")
    .select("id,client_id,report_month,pdf_url")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Unable to load report." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  if (existing.pdf_url) {
    const path = existing.pdf_url.split("/").slice(-2).join("/");
    await supabaseAdmin().storage.from("report-pdfs").remove([path]).catch(() => undefined);
  }

  const { error } = await supabaseAdmin().from("report_snapshots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Unable to delete report." }, { status: 500 });

  await recordActivity("report.deleted", {
    userId: user.id,
    clientId: existing.client_id,
    metadata: { reportMonth: existing.report_month, snapshotId: id },
  });

  return NextResponse.json({ ok: true, clientId: existing.client_id });
}
