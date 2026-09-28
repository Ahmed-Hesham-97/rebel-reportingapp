import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings2, FileText } from "lucide-react";
import { getClient } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LivePanel } from "@/components/clients/live-panel";
import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { DeleteReportIconButton } from "@/components/reports/delete-report-icon-button";
import { formatReportPeriodLabel } from "@/lib/reports/date-range";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { data: snapshots } = await supabaseAdmin()
    .from("report_snapshots")
    .select("id,report_month,period_end,status,created_at,error_log")
    .eq("client_id", id)
    .order("report_month", { ascending: false });

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Client workspace</p>
            <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">{client.name}</h1>
            <p className="mt-2 text-[var(--muted)]">{client.shopify_store_url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "admin" ? (
              <>
                <GenerateReportButton clientId={id} />
                <Button asChild variant="outline">
                  <Link href={`/clients/${id}/settings`}>
                    <Settings2 size={16} /> Settings
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </header>
        <div className="grid gap-6">
          <LivePanel clientId={id} />
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Report history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {snapshots?.length ? (
              <div className="divide-y divide-[var(--border)]">
                {snapshots.map((snapshot) => {
                  const label = formatReportPeriodLabel(snapshot.report_month, snapshot.period_end);
                  return (
                    <div key={snapshot.id} className="flex items-center gap-2 p-3 sm:p-2 sm:pr-3">
                      <Link
                        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-4 rounded-xl px-2 py-3 hover:bg-[var(--surface-muted)]"
                        href={`/reports/${snapshot.id}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <FileText size={18} className="shrink-0 text-[var(--brand)]" />
                            <span className="font-medium">{label}</span>
                          </div>
                          {snapshot.error_log ? (
                            <p className="mt-1 truncate pl-8 text-xs text-red-600">{snapshot.error_log}</p>
                          ) : null}
                        </div>
                        <StatusBadge status={snapshot.status} />
                      </Link>
                      {user.role === "admin" ? <DeleteReportIconButton reportId={snapshot.id} label={label} /> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-[var(--muted)]">No reports generated yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
