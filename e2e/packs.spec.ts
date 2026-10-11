import { expect, test } from "@playwright/test";

// Mock mode: state lives for one page load, so each test stays on a single load.
test.describe("packs", () => {
  test("mark the first pack posted, enter metrics, see both on the card", async ({ page }) => {
    await page.goto("/runs/run_hound_demo/packs");
    const card = page.locator('[data-testid^="pack-card-"]').first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("pack-status")).toHaveAttribute("data-state", "ready");

    await card.getByTestId("pack-mark-posted").click();
    const dialog = page.getByRole("dialog", { name: "Mark as posted" });
    const url = dialog.getByLabel("Post URL");
    await url.fill("not a link");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toContainText("does not look like a link");
    await url.fill("https://www.tiktok.com/@hound/video/7311111111111111111");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await expect(card.getByTestId("pack-status")).toHaveAttribute("data-state", "posted");
    await expect(card.getByTestId("pack-posted")).toContainText("tiktok.com/@hound/video/7311111111111111111");
    await expect(card.getByTestId("pack-posted")).toContainText("posted just now");
    await expect(card.getByTestId("pack-posted")).toContainText("Waiting for first metrics");

    await card.getByTestId("pack-enter-metrics").click();
    const metrics = page.getByRole("dialog", { name: "Enter metrics" });
    await metrics.getByRole("button", { name: "Save metrics" }).click();
    await expect(metrics.getByRole("alert")).toContainText("at least one number");
    await metrics.getByLabel("views").fill("-4");
    await metrics.getByRole("button", { name: "Save metrics" }).click();
    await expect(metrics.getByRole("alert")).toContainText("whole numbers");
    await metrics.getByLabel("views").fill("3214");
    await metrics.getByLabel("likes").fill("187");
    await metrics.getByRole("button", { name: "Save metrics" }).click();
    await expect(metrics).toBeHidden();

    await expect(card.getByTestId("pack-metrics")).toContainText("3,214");
    await expect(card.getByTestId("pack-metrics")).toContainText("187");
  });

  test("copy caption swaps the button to Copied and puts caption plus hashtags on the clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/runs/run_hound_demo/packs");
    const card = page.locator('[data-testid^="pack-card-"]').first();
    const caption = (await card.getByTestId("pack-caption").textContent()) ?? "";
    await card.getByTestId("pack-copy-caption").click();
    await expect(card.getByTestId("pack-copy-caption")).toContainText("Copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith(caption.trim())).toBe(true);
    expect(copied).toContain("#");
    await expect(card.getByTestId("pack-copy-caption")).toContainText("Copy", { timeout: 3000 });
    await expect(card.getByTestId("pack-copy-caption")).not.toContainText("Copied");
  });

  test("an unknown run shows an error with a retry", async ({ page }) => {
    await page.goto("/runs/run_does_not_exist/packs");
    await expect(page.getByRole("alert").filter({ hasText: "Could not load the packs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
