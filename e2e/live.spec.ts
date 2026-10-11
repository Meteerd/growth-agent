import { expect, type Page, test } from "@playwright/test";

// Live parity (E2E_DATA=live): the same screens against Lane A's real API routes and seeded data.
// Read-only on purpose: nothing here starts a run, so no provider is ever called.
test.skip(process.env.E2E_DATA !== "live", "live parity runs only with E2E_DATA=live");

function watchConsole(page: Page) {
  const errors: string[] = [];
  // media under /api/assets/ can exist only on the machine that rendered or analysed it; the UI shows a designed
  // placeholder for those, so a failed media load is expected. Every other console error fails the test.
  const missingMedia = new Set<string>();
  page.on("response", (r) => {
    if (r.status() === 404 && r.url().includes("/api/assets/")) missingMedia.add(r.url());
  });
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() !== "error" || /Download the React DevTools|favicon/.test(t)) return;
    if (/Failed to load resource: .*404/.test(t) && missingMedia.size) return;
    errors.push(t.slice(0, 300));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const ROUTES: [string, string, string][] = [
  ["/brands", "brand-card-hound", "portfolio"],
  ["/brands/hound", "dossier", "brand home"],
  ["/brands/hound/connect", "providers-engine", "connect"],
  ["/runs/run_hound_demo", "evidence-wall", "cockpit"],
  ["/runs/run_hound_demo/consult", "consult-done", "consult summary"],
  ["/runs/run_hound_demo/studio", "workbench", "studio"],
  ["/runs/run_hound_demo/packs", "pack-download", "packs"],
  ["/brands/hound/results", "", "results"],
  ["/settings", "", "settings"],
];

for (const [path, testId, name] of ROUTES) {
  test(`live: ${name} renders without console errors`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto(path);
    if (testId) await expect(page.getByTestId(testId).first()).toBeVisible({ timeout: 20_000 });
    else await expect(page.locator("main h1, main h2").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("live: blueprint view of the demo run", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/runs/run_hound_demo");
  const card = page.locator('[data-testid^="blueprint-"]').first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
  await expect(page.getByTestId("blueprint-view")).toBeVisible();
  await expect(page.locator('[data-testid^="remake-shot-"]').first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors, errors.join("\n")).toEqual([]);
});
