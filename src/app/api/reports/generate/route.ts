import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/authz";
import { generateReport } from "@/lib/reports/generate-report";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z
  .object({
    clientId: z.string().uuid().optional(),
    /** Inclusive period start (YYYY-MM-DD). Prefer the 1st of a month. */
    start: day.optional(),
    /** Exclusive period end (YYYY-MM-DD). */
    end: day.optional(),
    /** Legacy single-month support. */
    month: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.month) return;
    if (!value.start || !value.end) {
      ctx.addIssue({ code: "custom", message: "Provide start+end or month." });
      return;
    }
    if (!(value.end > value.start)) {
      ctx.addIssue({ code: "custom", message: "end must be after start." });
    }
  });

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid report period (month, quarter, or custom range)." }, { status: 400 });
  }

  const start = parsed.data.month ?? parsed.data.start!;
  const end = parsed.data.month
    ? undefined
    : parsed.data.end!;

  try {
    if (parsed.data.clientId) {
      return NextResponse.json(await generateReport(parsed.data.clientId, start, user.id, end));
    }
    const { data: clients, error } = await supabaseAdmin().from("clients").select("id").eq("is_active", true);
    if (error) throw new Error("Unable to load active clients.");
    const results = await Promise.all(
      (clients ?? []).map(async (client) => {
        try {
          return { clientId: client.id, ...(await generateReport(client.id, start, user.id, end)) };
        } catch {
          return { clientId: client.id, status: "failed" as const, error: "Report generation failed" };
        }
      }),
    );
    return NextResponse.json({ start, end: end ?? null, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate report." }, { status: 500 });
  }
}
