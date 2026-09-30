import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

function fontFile(name: string) {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "pdf", "font-files", name),
    path.join(process.cwd(), "node_modules", "@fontsource", name.startsWith("syne") ? "syne" : "dm-sans", "files", name),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Missing PDF font file: ${name} (cwd=${process.cwd()})`);
}

let registered = false;

/** Register Rebel brand fonts once per Node process for PDF rendering. */
export function registerReportFonts() {
  if (registered) return;
  Font.register({
    family: "DMSans",
    fonts: [
      { src: fontFile("dm-sans-latin-400-normal.woff"), fontWeight: 400 },
      { src: fontFile("dm-sans-latin-500-normal.woff"), fontWeight: 500 },
      { src: fontFile("dm-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Syne",
    fonts: [
      { src: fontFile("syne-latin-500-normal.woff"), fontWeight: 500 },
      { src: fontFile("syne-latin-700-normal.woff"), fontWeight: 700 },
      { src: fontFile("syne-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
