import "server-only";

import sharp from "sharp";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_EDGE = 1200;
const MAX_BYTES = 8 * 1024 * 1024;

function reportAssetPath(url: string): string | null {
  const marker = "/storage/v1/object/public/report-assets/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] ?? "");
}

async function loadImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const assetPath = reportAssetPath(url);
  if (assetPath) {
    const { data, error } = await supabaseAdmin().storage.from("report-assets").download(assetPath);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return { buffer, contentType: data.type || "image/jpeg" };
    }
    logger.warn({ assetPath, error: error?.message }, "report asset download failed; falling back to fetch");
  }

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function toPdfDataUri(buffer: Buffer): Promise<string | null> {
  if (!buffer.length || buffer.length > MAX_BYTES) return null;
  try {
    const resized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch (error) {
    logger.warn({ err: error }, "sharp resize failed for pdf image");
    // Last resort: embed original if it is already small enough for react-pdf.
    if (buffer.length <= 1.5 * 1024 * 1024) {
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
    return null;
  }
}

/**
 * Fetch report screenshots and embed as compact JPEG data URIs for react-pdf.
 * Falls back to the original URL when embedding fails so the PDF can still try a remote fetch.
 */
export async function embedImageUrls(urls: string[]): Promise<string[]> {
  const embedded: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("data:image/")) {
      embedded.push(trimmed);
      continue;
    }
    if (!trimmed.startsWith("http")) continue;
    try {
      const loaded = await loadImageBuffer(trimmed);
      if (!loaded) {
        embedded.push(trimmed);
        continue;
      }
      const dataUri = await toPdfDataUri(loaded.buffer);
      embedded.push(dataUri ?? trimmed);
    } catch (error) {
      logger.warn({ err: error, url: trimmed.slice(0, 120) }, "pdf image embed failed");
      embedded.push(trimmed);
    }
  }
  return embedded;
}
