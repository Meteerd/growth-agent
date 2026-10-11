import { expect, test } from "@playwright/test";

// BS2: Cmd+K jumps to a brand, a run screen or an app screen, keyboard only.
test("command palette", async ({ page }) => {
  await page.goto("/runs/run_hound_demo");
  await expect(page.getByTestId("evidence-wall")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByTestId("palette");
  await expect(palette).toBeVisible();
  await page.keyboard.type("direction");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/runs\/run_hound_demo\/direction$/);
  await page.getByTestId("palette-open").click();
  await page.keyboard.type("a.clinic");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/brands\/aclinic$/);
});
