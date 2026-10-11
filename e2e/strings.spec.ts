import { expect, test } from "@playwright/test";

// Long names and non-English text (Turkish, Slovak, Czech) must not break layouts at phone width.
const LONG_SK =
  "Lekársky dohľad nad chudnutím online pre Slovensko a Česko: konzultácia, plán, kontrola každý týždeň, bez čakania v ambulancii a bez skrytých poplatkov.";

test("long Unicode names and dossier text fit at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/brands/new");
  await page.getByLabel("Brand website").fill("cokuzunbirmarkaismisaglikvegüzellikürünleri.com.tr");
  await page.getByRole("button", { name: "Add brand" }).click();
  await expect(page.getByTestId("intake-done")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to portfolio" }).click();
  const card = page.locator('[data-testid^="brand-card-cokuzunbirmarkaismisaglikveguzellikurunleri"]');
  await expect(card).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await card.click();
  const field = page.getByTestId("edit-one-liner");
  await field.getByRole("button", { name: "Edit" }).click();
  await field.getByRole("textbox").fill(LONG_SK);
  await field.getByRole("button", { name: "Save" }).click();
  await expect(field).toContainText("každý týždeň");
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "logs/strings-mobile.png", fullPage: true });
});
