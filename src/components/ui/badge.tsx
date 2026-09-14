import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    partial: "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-blue-700",
    pending: "bg-slate-100 text-slate-600",
    failed: "bg-red-50 text-red-700",
  };
  return <Badge className={styles[status] ?? "bg-slate-100 text-slate-600"}>{status}</Badge>;
}
