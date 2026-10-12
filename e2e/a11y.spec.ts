import { expect, test } from "@playwright/test";

test.describe("keyboard and reduced motion", () => {
  test("landing works with the keyboard only", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Brand website");
    for (let i = 0; i < 12 && !(await input.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    await page.keyboard.type("keyboard-only.com");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/brands\/new\?url=/);
    await expect(page.getByTestId("intake-stream")).toBeVisible();
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    await page.goto("/brands");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return `${cs.outlineStyle} ${cs.outlineWidth}`;
    });
    expect(outline).not.toMatch(/^none/);
  });

  test("reduced motion: the playhead does not autoplay and the landing video stays still", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/runs/run_hound_demo/blueprints/bp_hound_1");
    await expect(page.getByTestId("blueprint-view")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("rewatch")).toContainText("Play both");
    const t = await page.getByTestId("timeline").getAttribute("aria-valuenow");
    expect(Number(t)).toBeLessThan(0.1);
    await page.goto("/");
    await page.waitForTimeout(1500);
    const playing = await page.locator('[data-testid="featured"] video').evaluateAll((vs) => vs.some((v) => !(v as HTMLVideoElement).paused));
    expect(playing).toBe(false);
    await ctx.close();
  });
});
