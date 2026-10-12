import { expect, test } from "@playwright/test";

test("landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page).toHaveTitle(/Rekampols/);
});

test("landing shows the four brands with their flagship videos and real numbers", async ({ page }) => {
  await page.goto("/");
  for (const slug of ["hound", "aclinic", "dynova", "evreon"]) {
    const row = page.getByTestId(`brand-${slug}`);
    await expect(row).toContainText(/self-review \d+\/100/);
    // poster frames are committed files, so every tile has a picture on a fresh clone and offline
    const poster = await row.locator("video").getAttribute("poster");
    expect((await page.request.get(poster!)).ok()).toBe(true);
  }
  await expect(page.getByText(/real competitor ads and posts researched \(kept from \d+ found\)/)).toBeVisible();
  expect((await page.request.get("/renders/hound-flagship.mp4", { headers: { range: "bytes=0-99" } })).status()).toBe(
    206,
  );
});
