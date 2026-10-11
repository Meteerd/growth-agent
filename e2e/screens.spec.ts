import { expect, test } from "@playwright/test";

// Screenshots of every route at desktop and mobile for the morning review (e2e/screens/, committed).
const ROUTES: [name: string, path: string][] = [
  ["landing", "/"],
  ["lab", "/lab"],
  ["portfolio", "/brands"],
  ["enter", "/brands/new"],
  ["brand-home", "/brands/hound"],
  ["connect", "/brands/hound/connect"],
  ["cockpit", "/runs/run_hound_demo"],
  ["consult", "/runs/run_hound_demo/consult"],
  ["packs", "/runs/run_hound_demo/packs"],
  ["results", "/brands/hound/results"],
  ["settings", "/settings"],
];
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

for (const [name, path] of ROUTES) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    test(`screen ${name} ${size}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200); // let entrance motion settle so no frame is half-revealed
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
      await page.screenshot({ path: `e2e/screens/${name}-${size}.png`, fullPage: false });
    });
  }
}
