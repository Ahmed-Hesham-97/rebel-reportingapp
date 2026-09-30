import "server-only";

/**
 * Fetch remote screenshots and embed as data URIs so react-pdf does not depend
 * on outbound fetch during layout (flaky with storage CDNs on serverless).
 */
export async function embedImageUrls(urls: string[]): Promise<string[]> {
  const embedded: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (trimmed.startsWith("data:image/")) {
      embedded.push(trimmed);
      continue;
    }
    if (!trimmed.startsWith("http")) continue;
    try {
      const response = await fetch(trimmed, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 6 * 1024 * 1024) continue;
      embedded.push(`data:${contentType.split(";")[0]};base64,${buffer.toString("base64")}`);
    } catch {
      // Skip broken uploads rather than failing the whole PDF.
    }
  }
  return embedded;
}
