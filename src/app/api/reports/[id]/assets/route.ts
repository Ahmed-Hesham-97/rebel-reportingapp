import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

/** Uploads an image for a report field (e.g. top performing content screenshot). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: report } = await db.from("report_snapshots").select("id,client_id").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const field = String(form?.get("field") ?? "topContentImage");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose or paste an image file." }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }

  const safeField = field.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "image";
  const path = `${report.client_id}/${report.id}/${safeField}-${Date.now()}.${extension(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await db.storage.from("report-assets").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message || "Upload failed." }, { status: 500 });
  }

  const { data: published } = db.storage.from("report-assets").getPublicUrl(path);
  return NextResponse.json({ url: published.publicUrl, path });
}
