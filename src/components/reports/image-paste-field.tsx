"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  reportId: string;
  value: string;
  onChange: (url: string) => void;
};

export function ImagePasteField({ reportId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("field", "topContentImage");
    const response = await fetch(`/api/reports/${reportId}/assets`, { method: "POST", body });
    setUploading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Upload failed.");
      return;
    }
    const payload = (await response.json()) as { url?: string };
    if (!payload.url) {
      setError("Upload succeeded but no URL was returned.");
      return;
    }
    onChange(payload.url);
  }

  function takeFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Paste or choose an image file.");
      return;
    }
    void upload(file);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        takeFile(item.getAsFile());
        return;
      }
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    takeFile(event.dataTransfer.files?.[0]);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    takeFile(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`rounded-xl border border-dashed p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900 ${
          dragging ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        {value ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Top performing content" className="max-h-56 max-w-full rounded-lg border border-slate-200 object-contain" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                <Upload size={14} /> Replace
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => onChange("")}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <ImagePlus size={18} /> Add a screenshot
            </div>
            <p className="text-xs text-slate-500">Paste (Ctrl+V / ⌘V), drag and drop, or choose a file. JPEG, PNG, WebP, or GIF up to 5 MB.</p>
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload size={14} /> {uploading ? "Uploading…" : "Choose image"}
            </Button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFileChange} />
      </div>
      {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
