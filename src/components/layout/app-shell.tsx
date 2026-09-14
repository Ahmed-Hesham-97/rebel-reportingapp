import Link from "next/link";
import { BarChart3, Building2, LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-slate-950 text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-b-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid size-9 place-items-center rounded-xl bg-red-500 font-black">R</div>
          <div>
            <p className="font-bold tracking-tight">Rebel Reports</p>
            <p className="text-xs text-slate-400">Rebel Marketing</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-auto px-3 pb-4 md:block md:flex-1 md:space-y-1">
          <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white" href="/dashboard">
            <BarChart3 size={17} /> Dashboard
          </Link>
          <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white" href="/clients/new">
            <Building2 size={17} /> Add client
          </Link>
        </nav>
        <div className="hidden border-t border-white/10 p-4 md:block">
          <p className="truncate px-2 text-xs text-slate-400">{user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" className="mt-2 w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut size={16} /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:ml-64">{children}</main>
    </div>
  );
}
