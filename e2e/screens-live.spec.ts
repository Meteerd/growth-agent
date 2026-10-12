import { expect, test } from "@playwright/test";

// Live screenshots for the morning review: the real data and the flagship remakes (E2E_DATA=live only).
test.skip(process.env.E2E_DATA !== "live", "live screenshots need the real API routes");

const SHOWCASE = "run_mv4e0ud7671d68be0a"; // Hound flagship showcase run, seeded on every machine
const ROUTES: [string, string][] = [
  ["landing", "/"],
  ["portfolio", "/brands"],
  ["brand-home", "/brands/hound"],
  ["reverse-engineer", `/runs/${SHOWCASE}/blueprints/bp_mv4cfk3o0860575961_68be0a`],
  ["cockpit", `/runs/${SHOWCASE}`],
  ["direction", `/runs/${SHOWCASE}/direction`],
  ["studio", `/runs/${SHOWCASE}/studio`],
  ["packs", `/runs/${SHOWCASE}/packs`],
  ["settings", "/settings"],
];
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

for (const [name, path] of ROUTES) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    test(`live screen ${name} ${size}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(3500); // media and the playhead's first pass
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(
        0,
      );
      await page.screenshot({ path: `e2e/screens/live/${name}-${size}.png` });
    });
  }
}
