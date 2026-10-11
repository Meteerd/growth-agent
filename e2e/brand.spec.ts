import { expect, test } from "@playwright/test";
import { PROVIDER_INFO } from "@/contracts";

test.describe("brand home and connect", () => {
  test("edit a dossier field and see it persist", async ({ page }) => {
    await page.goto("/brands/hound");
    const field = page.getByTestId("edit-one-liner");
    await expect(field).toContainText("A daily behavior plan");
    await field.getByRole("button", { name: "Edit" }).click();
    await field.getByRole("textbox").fill("Ten minutes a day of training built for your dog.");
    await field.getByRole("button", { name: "Save" }).click();
    await expect(field).toContainText("Ten minutes a day of training built for your dog.");
    // leave and come back through client navigation: the PATCHed value is what the client serves now
    await page.getByRole("link", { name: "Connect" }).click();
    await expect(page.getByTestId("providers-engine")).toBeVisible();
    await page.getByRole("link", { name: "Dossier" }).click();
    await expect(page.getByTestId("edit-one-liner")).toContainText("Ten minutes a day of training built for your dog.");
  });

  test("connect page shows every provider", async ({ page }) => {
    await page.goto("/brands/aclinic/connect");
    for (const info of Object.values(PROVIDER_INFO))
      await expect(page.getByRole("heading", { name: info.label, exact: true })).toBeVisible();
  });

  test("unknown brand shows a designed not-found state", async ({ page }) => {
    await page.goto("/brands/no-such-brand");
    await expect(page.getByText("This brand is not in the portfolio")).toBeVisible();
  });
});
