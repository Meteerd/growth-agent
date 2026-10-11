import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/engine/e2e/**/*.e2e.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    env: { NEXUS_TEST: "1", MANUS_WAIT_SEC: "1" },
  },
});
