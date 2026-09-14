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

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { data: snapshots } = await supabaseAdmin().from("report_snapshots").select("id,report_month,status,created_at,error_log").eq("client_id", id).order("report_month", { ascending: false });
  return <div className="p-6 lg:p-10"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to dashboard</Link>
    <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-sm font-semibold text-red-500">Client workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{client.name}</h1><p className="mt-2 text-slate-500">{client.shopify_store_url}</p></div><div className="flex flex-wrap gap-2">{user.role === "admin" && <><GenerateReportButton clientId={id} /><Button asChild variant="outline"><Link href={`/clients/${id}/settings`}><Settings2 size={16} /> Settings</Link></Button></>}</div></header>
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <LivePanel clientId={id} />
      <Card><CardHeader><CardTitle>Report recipients</CardTitle></CardHeader><CardContent><div className="space-y-2 text-sm text-slate-600">{client.report_recipients.length ? client.report_recipients.map((email) => <p key={email}>{email}</p>) : <p>No recipients configured.</p>}</div></CardContent></Card>
    </div>
    <Card className="mt-6"><CardHeader><CardTitle>Report history</CardTitle></CardHeader><CardContent className="p-0">{snapshots?.length ? <div className="divide-y">{snapshots.map((snapshot) => <Link className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50" key={snapshot.id} href={`/reports/${snapshot.id}`}><div className="flex items-center gap-3"><FileText size={18} className="text-red-500" /><span className="font-medium">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${snapshot.report_month}T12:00:00Z`))}</span></div><StatusBadge status={snapshot.status} /></Link>)}</div> : <div className="p-10 text-center text-sm text-slate-500">No reports generated yet.</div>}</CardContent></Card>
  </div></div>;
}

