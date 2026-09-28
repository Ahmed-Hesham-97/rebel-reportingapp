import Link from "next/link";
import { ArrowUpRight, Plus, Users, FileCheck2, Clock3 } from "lucide-react";
import { listClients } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

type SnapshotSummary = {
  id: string;
  client_id: string;
  report_month: string;
  status: "pending" | "processing" | "partial" | "completed" | "failed";
  created_at: string;
};

const FLASH: Record<string, string> = {
  shopify_state: "Shopify connection expired before it finished. Open the client settings and click Connect with Shopify again.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flashKey = typeof params.error === "string" ? params.error : undefined;
  const flash = flashKey ? FLASH[flashKey] : undefined;

  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let loadError: string | null = null;
  try {
    clients = await listClients();
  } catch {
    loadError = "Unable to load clients from the database. Check Supabase env vars on Vercel.";
  }

  const clientIds = clients.map((client) => client.id);
  const snapshots: SnapshotSummary[] = clientIds.length
    ? await supabaseAdmin()
        .from("report_snapshots")
        .select("id,client_id,report_month,status,created_at")
        .in("client_id", clientIds)
        .order("report_month", { ascending: false })
        .then(({ data }) => (data ?? []) as SnapshotSummary[])
    : [];
  const latestByClient = new Map<string, SnapshotSummary>();
  for (const snapshot of snapshots) if (!latestByClient.has(snapshot.client_id)) latestByClient.set(snapshot.client_id, snapshot);
  const completed = snapshots.filter((snapshot) => snapshot.status === "completed").length;
  const processing = snapshots.filter((snapshot) => snapshot.status === "processing").length;

  return (
    <div className="p-6 lg:p-10">
      {flash ? <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{flash}</div> : null}
      {loadError ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div> : null}
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Overview</p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">Client reporting</h1>
          <p className="mt-2 text-[var(--muted)]">Monitor your agency&apos;s ecommerce performance reports.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus size={17} /> Add client
          </Link>
        </Button>
      </header>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Users size={18} />} label="Active clients" value={String(clients.filter((client) => client.is_active).length)} />
        <StatCard icon={<FileCheck2 size={18} />} label="Completed reports" value={String(completed)} />
        <StatCard icon={<Clock3 size={18} />} label="In progress" value={String(processing)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {loadError ? "Clients could not be loaded." : "No clients yet. Add your first client to begin reporting."}
            </div>
          ) : (
            <div className="divide-y">
              {clients.map((client) => {
                const snapshot = latestByClient.get(client.id);
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{client.name}</p>
                      <p className="truncate text-sm text-slate-500">{client.shopify_store_url}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {snapshot ? <StatusBadge status={snapshot.status} /> : <span className="text-xs text-slate-400">No reports</span>}
                      <ArrowUpRight size={18} className="text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-500">{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
