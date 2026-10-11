import { test } from "@playwright/test";
test("kit", async ({ page }) => {
  await page.goto("/lab");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const el = page.locator("section", { has: page.getByRole("heading", { name: "Components" }) });
  await el.screenshot({ path: "logs/kit.png" });
});
