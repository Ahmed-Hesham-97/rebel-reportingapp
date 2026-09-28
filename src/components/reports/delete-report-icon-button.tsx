"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteReportIconButton({ reportId, label }: { reportId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Delete the ${label} report? This cannot be undone.`)) return;
    setPending(true);
    const response = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      window.alert("Unable to delete report.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      aria-label={`Delete ${label} report`}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}
