"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  reportId: string;
  values: string[];
  onChange: (urls: string[]) => void;
  max?: number;
};

const DEFAULT_MAX = 8;

export function ImagePasteField({ reportId, values, onChange, max = DEFAULT_MAX }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const urls = values.filter((url) => url.trim().startsWith("http"));
  const full = urls.length >= max;

  async function upload(file: File) {
    if (full) {
      setError(`You can add up to ${max} images.`);
      return;
    }
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
    if (urls.includes(payload.url)) {
      setError("That image is already attached.");
      return;
    }
    onChange([...urls, payload.url]);
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
    const files = [...(event.dataTransfer.files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      setError("Drop an image file.");
      return;
    }
    void (async () => {
      for (const file of files.slice(0, Math.max(0, max - urls.length))) {
        await upload(file);
      }
    })();
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    void (async () => {
      for (const file of files.slice(0, Math.max(0, max - urls.length))) {
        await upload(file);
      }
    })();
  }

  function removeAt(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {urls.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Top performing content ${index + 1}`} className="max-h-48 w-full object-contain bg-slate-50" />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                <span className="text-xs text-slate-500">Image {index + 1}</span>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => removeAt(index)}>
                  <Trash2 size={14} /> Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

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
            if (!full) inputRef.current?.click();
          }
        }}
        className={`rounded-xl border border-dashed p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900 ${
          dragging ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-slate-50"
        } ${full ? "opacity-60" : ""}`}
      >
        <div className="flex flex-col items-start gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <ImagePlus size={18} /> {urls.length ? "Add another screenshot" : "Add screenshots"}
          </div>
          <p className="text-xs text-slate-500">
            Paste (Ctrl+V / ⌘V), drag and drop, or choose files. JPEG, PNG, WebP, or GIF up to 5 MB each. Up to {max} images
            {urls.length ? ` · ${urls.length}/${max} added` : ""}.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={uploading || full} onClick={() => inputRef.current?.click()}>
            <Upload size={14} /> {uploading ? "Uploading…" : "Choose images"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
