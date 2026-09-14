import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getApiUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toReportSnapshot } from "@/lib/reports/snapshot";
import { ReportDocument } from "@/lib/pdf/report-document";
import { normalizeSections } from "@/lib/reports/sections";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: row, error } = await supabaseAdmin().from("report_snapshots").select("id,client_id,report_month,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,created_at,included_sections,delivered_at").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load report." }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const { data: client } = await supabaseAdmin().from("clients").select("name,brand_logo_url").eq("id", row.client_id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  // A preview renders whatever sections the reviewer currently has checked and
  // never uploads or emails anything; delivery is an explicit, separate action.
  const requested = new URL(request.url).searchParams.get("sections");
  const sections = normalizeSections(requested ? requested.split(",") : row.included_sections);
  try {
    const snapshot = { ...toReportSnapshot(row), includedSections: sections };
    const buffer = await renderToBuffer(createElement(ReportDocument, { snapshot, clientName: client.name, logoUrl: client.brand_logo_url }) as never);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${client.name.replace(/[^a-z0-9]+/gi, "-")}-${row.report_month}.pdf"` } });
  } catch {
    return NextResponse.json({ error: "Unable to render PDF." }, { status: 500 });
  }
}
