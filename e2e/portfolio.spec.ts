import { expect, test } from "@playwright/test";

test.describe("portfolio and enter", () => {
  test("portfolio lists the four seeded brands", async ({ page }) => {
    await page.goto("/brands");
    for (const slug of ["hound", "aclinic", "dynova", "evreon"])
      await expect(page.getByTestId(`brand-card-${slug}`)).toBeVisible();
  });

  test("create a brand from the landing page and see it in the portfolio", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Brand website").fill("example-dogs.com");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/brands\/new\?url=/);
    await expect(page.getByTestId("intake-stream")).toBeVisible();
    await expect(page.getByTestId("intake-done")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Back to portfolio" }).click(); // client navigation keeps mock state
    await expect(page.getByTestId("brand-card-example-dogs")).toBeVisible();
    await expect(page.getByTestId("brand-card-example-dogs")).toContainText("Example-dogs");
  });

  test("invalid URL explains itself and does not submit", async ({ page }) => {
    await page.goto("/brands/new");
    await page.getByLabel("Brand website").fill("not a site");
    await page.getByRole("button", { name: "Add brand" }).click();
    await expect(page.locator("#brand-url-error")).toContainText("does not look like a website");
    await expect(page.getByTestId("intake-stream")).toHaveCount(0);
  });
});
