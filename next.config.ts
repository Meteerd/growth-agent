import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // the studio deploy builds into a side directory first (deploy/studio/deploy.sh)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: [
    "@libsql/client",
    "libsql",
    "sharp",
    "@remotion/renderer",
    "@remotion/bundler",
    "@playwright/test",
    "playwright-core",
    "opentype.js",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
