import { defineConfig, devices } from "@playwright/test";

// E2E_DATA=live runs the same specs against Lane A's real API routes; default is the in-browser mock.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATA = process.env.E2E_DATA === "live" ? "live" : "mock";

export default defineConfig({
  testDir: "e2e",
  outputDir: "logs/playwright",
  reporter: [["line"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", reducedMotion: "no-preference" },
  projects: [{ name: DATA, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_PUBLIC_DATA_MODE: DATA, NEXT_PUBLIC_MOCK_RUN_MS: process.env.MOCK_RUN_MS ?? "20000" },
  },
});
