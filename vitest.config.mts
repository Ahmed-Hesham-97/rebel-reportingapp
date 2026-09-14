import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(root, "./src"), "server-only": path.resolve(root, "./src/test/server-only.ts") } },
});
