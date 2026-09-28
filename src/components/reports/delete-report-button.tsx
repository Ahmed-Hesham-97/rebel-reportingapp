"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteReportButton({ reportId, clientId, label }: { reportId: string; clientId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (!window.confirm(`Delete the ${label} report? This cannot be undone.`)) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to delete report.");
      return;
    }
    router.push(`/clients/${clientId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
        <Trash2 size={16} />
        {pending ? "Deleting…" : "Delete report"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
