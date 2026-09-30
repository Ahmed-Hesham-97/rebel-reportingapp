import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Ensure WOFF brand fonts ship with the PDF route on Vercel (dynamic fs paths aren't auto-traced).
  outputFileTracingIncludes: {
    "/reports/[id]/pdf": ["./src/lib/pdf/font-files/**/*"],
  },
};

export default nextConfig;
