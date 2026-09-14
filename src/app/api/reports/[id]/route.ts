import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabaseAdmin().from("report_snapshots").select("id,client_id,report_month,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,created_at").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load report." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ id: data.id, clientId: data.client_id, reportMonth: data.report_month, shopify: data.shopify_data, klaviyo: data.klaviyo_data, meta: data.meta_data, pdfUrl: data.pdf_url, status: data.status, errorLog: data.error_log, createdAt: data.created_at });
}
