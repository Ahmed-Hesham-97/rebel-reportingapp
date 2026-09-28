import Link from "next/link";
import { BarChart3, Building2 } from "lucide-react";
import { AUTH_DISABLED, requireUser } from "@/lib/authz";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-white/10 bg-[var(--sidebar)] text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-b-0">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="grid size-10 place-items-center rounded-2xl bg-[var(--brand)] font-display text-lg font-extrabold shadow-[0_10px_30px_rgba(225,29,72,0.35)]">
            R
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-tight">Rebel Reports</p>
            <p className="text-xs text-[var(--sidebar-muted)]">Rebel Marketing</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-auto px-3 pb-4 md:block md:flex-1 md:space-y-1">
          <Link
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
            href="/dashboard"
          >
            <BarChart3 size={17} /> Dashboard
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
            href="/clients/new"
          >
            <Building2 size={17} /> Add client
          </Link>
        </nav>
        <div className="hidden border-t border-white/10 p-4 md:block">
          <p className="truncate px-2 text-xs text-[var(--sidebar-muted)]">
            {AUTH_DISABLED ? "Auth disabled (temporary)" : user.email}
          </p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:ml-64">{children}</main>
    </div>
  );
}
