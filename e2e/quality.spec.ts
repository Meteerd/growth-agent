import { expect, test } from "@playwright/test";

// Improvement loop: every route renders with zero console errors or warnings, and fits a 768 px tablet.
const ROUTES = [
  "/",
  "/brands",
  "/brands/new",
  "/brands/hound",
  "/brands/hound/connect",
  "/brands/hound/results",
  "/runs/run_hound_demo",
  "/runs/run_hound_demo/consult",
  "/runs/run_hound_demo/direction",
  "/runs/run_hound_demo/studio",
  "/runs/run_hound_demo/packs",
  "/runs/run_hound_demo/blueprints/bp_hound_1",
  "/settings",
  "/no/such/page",
];

for (const path of ROUTES) {
  test(`clean console and tablet fit on ${path}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (
        (m.type() === "error" || m.type() === "warning") &&
        !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(t)
      )
        problems.push(`${m.type()}: ${t.slice(0, 200)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(path);
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "no horizontal scroll at 768").toBeLessThanOrEqual(0);
    // the 404 route answers 404 on purpose; anything else on the console is a bug
    expect(
      problems.filter((p) => !(path.startsWith("/no/") && /404/.test(p))),
      problems.join("\n"),
    ).toEqual([]);
  });
}

test("back and forward keep screens intact", async ({ page }) => {
  await page.goto("/brands");
  await page.getByTestId("brand-card-hound").click();
  await expect(page.getByTestId("dossier")).toBeVisible();
  await page.getByRole("link", { name: "Connect" }).click();
  await expect(page.getByTestId("providers-engine")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("dossier")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("brand-grid")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("dossier")).toBeVisible();
});
