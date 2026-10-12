import { expect, test } from "@playwright/test";

test("landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page).toHaveTitle(/Nexus/);
});

test("landing shows the four flagship cuts with their real self-review scores", async ({ page }) => {
  await page.goto("/");
  for (const [slug, score] of [
    ["hound", "83/100"],
    ["aclinic", "82/100"],
    ["dynova", "81/100"],
    ["evreon", "81/100"],
  ]) {
    const row = page.getByTestId(`cut-${slug}`);
    await expect(row.getByText(score)).toBeVisible();
    // the contact sheet is a committed file, so it loads in mock mode on a fresh clone
    await row.scrollIntoViewIfNeeded();
    const sheet = row.locator("img[alt*='one frame per shot']");
    await expect.poll(() => sheet.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  }
});
