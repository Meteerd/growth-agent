import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "remotion/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    // full-pipeline tests render videos; slow laptops under load need headroom (Lane B request 12 Oct 01:08)
    testTimeout: 120_000,
    hookTimeout: 180_000,
    env: { NEXUS_TEST: "1" },
  },
});
