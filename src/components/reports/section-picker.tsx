"use client";

import { useState } from "react";
import { Check, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_SECTIONS } from "@/lib/reports/sections";

type Props = {
  reportId: string;
  initialSections: string[];
  /** Sections whose data source this client has connected. */
  availableSections: string[];
  deliveredAt: string | null;
  canDeliver: boolean;
};

export function SectionPicker({ reportId, initialSections, availableSections, deliveredAt, canDeliver }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSections);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [sentAt, setSentAt] = useState(deliveredAt);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setMessage("");
  }

  async function send() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/reports/${reportId}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: selected }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (response.ok) {
      setSentAt(new Date().toISOString());
      setMessage("Report sent to the client recipients.");
      return;
    }
    setMessage(body.error ?? "Unable to send the report.");
  }

  const previewHref = `/reports/${reportId}/pdf?sections=${selected.join(",")}`;

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Sections to include in the client PDF</legend>
        <ul className="space-y-2">
          {REPORT_SECTIONS.filter((section) => availableSections.includes(section.id)).map((section) => {
            const checked = selected.includes(section.id);
            return (
              <li key={section.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(section.id)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    <span className="block text-sm font-medium">{section.label}</span>
                    <span className="block text-xs text-slate-500">{section.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" disabled={!selected.length}>
          <a href={previewHref} target="_blank" rel="noreferrer">
            <Download size={16} /> Preview PDF
          </a>
        </Button>
        {canDeliver && (
          <Button onClick={send} disabled={pending || !selected.length}>
            <Send size={16} /> {pending ? "Sending…" : sentAt ? "Resend to client" : "Approve & send to client"}
          </Button>
        )}
        {sentAt && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check size={14} /> Sent {new Date(sentAt).toLocaleString("en-US")}
          </span>
        )}
      </div>

      {!selected.length && <p className="mt-3 text-xs text-amber-700">Select at least one section before previewing or sending.</p>}
      {message && (
        <p role="status" className="mt-3 text-xs text-slate-600">
          {message}
        </p>
      )}
      {!canDeliver && <p className="mt-3 text-xs text-slate-500">Only admins can send reports to clients.</p>}
    </div>
  );
}
