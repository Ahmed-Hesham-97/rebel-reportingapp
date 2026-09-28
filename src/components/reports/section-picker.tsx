"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_SECTIONS } from "@/lib/reports/sections";

type Props = {
  reportId: string;
  initialSections: string[];
  availableSections: string[];
};

export function SectionPicker({ reportId, initialSections, availableSections }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSections);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setMessage("");
  }

  async function downloadPdf() {
    if (!selected.length) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/reports/${reportId}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: selected }),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.error ?? "Unable to prepare the PDF.");
      return;
    }
    window.open(`/reports/${reportId}/pdf?sections=${selected.join(",")}&download=1`, "_blank", "noopener,noreferrer");
    setMessage("PDF download started.");
  }

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Sections to include in the PDF</legend>
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
                    className="mt-0.5 size-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
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
        <Button onClick={downloadPdf} disabled={pending || !selected.length}>
          <Download size={16} /> {pending ? "Preparing…" : "Download PDF"}
        </Button>
        <Button asChild variant="outline" disabled={!selected.length}>
          <a href={`/reports/${reportId}/pdf?sections=${selected.join(",")}`} target="_blank" rel="noreferrer">
            Preview in browser
          </a>
        </Button>
      </div>

      {!selected.length ? <p className="mt-3 text-xs text-amber-700">Select at least one section before downloading.</p> : null}
      {message ? (
        <p role="status" className="mt-3 text-xs text-slate-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
