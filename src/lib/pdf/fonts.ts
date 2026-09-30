import "server-only";

import path from "node:path";
import { Font } from "@react-pdf/renderer";

const files = (...parts: string[]) => path.join(process.cwd(), "node_modules", ...parts);

let registered = false;

/** Register Rebel brand fonts once per Node process for PDF rendering. */
export function registerReportFonts() {
  if (registered) return;
  Font.register({
    family: "DMSans",
    fonts: [
      { src: files("@fontsource", "dm-sans", "files", "dm-sans-latin-400-normal.woff"), fontWeight: 400 },
      { src: files("@fontsource", "dm-sans", "files", "dm-sans-latin-500-normal.woff"), fontWeight: 500 },
      { src: files("@fontsource", "dm-sans", "files", "dm-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Syne",
    fonts: [
      { src: files("@fontsource", "syne", "files", "syne-latin-500-normal.woff"), fontWeight: 500 },
      { src: files("@fontsource", "syne", "files", "syne-latin-700-normal.woff"), fontWeight: 700 },
      { src: files("@fontsource", "syne", "files", "syne-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  // Prefer glyph-aware hyphenation off for metrics tables.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
