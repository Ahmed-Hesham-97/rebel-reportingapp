import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toReportSnapshot } from "@/lib/reports/snapshot";
import { ReportDocument } from "@/lib/pdf/report-document";
import { sendReportEmail } from "@/lib/email/resend";

export async function renderUploadAndEmailReport(snapshotId: string) {
  const db = supabaseAdmin();
  const { data: row } = await db.from("report_snapshots").select("id,client_id,report_month,shopify_data,klaviyo_data,meta_data,pdf_url,status,error_log,created_at,included_sections,delivered_at").eq("id", snapshotId).single();
  if (!row) throw new Error("Report not found");
  const { data: client } = await db.from("clients").select("name,brand_logo_url,report_recipients").eq("id", row.client_id).single();
  if (!client) throw new Error("Client not found");
  const buffer = await renderToBuffer(createElement(ReportDocument, { snapshot: toReportSnapshot(row), clientName: client.name, logoUrl: client.brand_logo_url }) as never);
  const path = `${row.client_id}/${row.report_month}.pdf`;
  const upload = await db.storage.from("report-pdfs").upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (upload.error) throw upload.error;
  await sendReportEmail(client.report_recipients, client.name, row.report_month, buffer);
  await db.from("report_snapshots").update({ pdf_url: path, delivered_at: new Date().toISOString() }).eq("id", snapshotId);
  return path;
}
