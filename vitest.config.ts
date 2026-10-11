import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "remotion/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    testTimeout: 30_000,
    env: { NEXUS_TEST: "1" },
  },
});
