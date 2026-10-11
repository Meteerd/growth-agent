import { expect, test } from "@playwright/test";

// Mock mode: state lives for one page load, so the edits stay on a single load.
test.describe("direction", () => {
  test("ranked table, channel drawer, drop and reorder write new plan versions", async ({ page }) => {
    await page.goto("/runs/run_hound_demo/direction");
    await expect(page.getByTestId("plan-version")).toHaveText("v1");
    await expect(page.getByTestId("plan-weights")).toContainText("25%");

    // the table: one row per recommended channel, TikTok first
    const rows = page.locator('[data-testid^="rank-row-"]');
    await expect(page.getByTestId("ranked-list")).toBeVisible();
    await expect(rows.first()).toHaveAttribute("data-testid", "rank-row-tiktok");
    await expect(page.getByTestId("rank-row-meta_ads")).toBeVisible();

    // the channel name is the keyboard path into the drawer
    await page.getByTestId("rank-open-tiktok").focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "TikTok" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("evidence-drawer")).toContainText("First steps");
    await expect(drawer.getByTestId("axis-bars").locator("[data-axis]")).toHaveCount(6);
    await expect(drawer.locator("article[data-source]").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // a row click opens the same drawer
    await page.getByTestId("rank-row-instagram_reels").click();
    await expect(page.getByRole("dialog", { name: "Instagram Reels" })).toBeVisible();
    await page.keyboard.press("Escape");

    // drop a channel with a reason: it moves to Not now, struck through, and the plan becomes v2
    await page.getByTestId("rank-drop-meta_ads").click();
    const dialog = page.getByRole("dialog", { name: "Drop Meta paid?" });
    await dialog.getByLabel("Reason (optional)").fill("No ad budget this month");
    await dialog.getByLabel("Reason (optional)").press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("rank-row-meta_ads")).toHaveCount(0);
    const dropped = page.getByTestId("notnow-row-meta_ads");
    await expect(dropped).toContainText("No ad budget this month");
    await expect(dropped.locator("s")).toHaveCSS("text-decoration-line", "line-through");
    await expect(page.getByTestId("plan-version")).toHaveText("v2");

    // reorder: move the second pick up, it becomes priority 1 in v3
    await page.getByTestId("rank-up-instagram_reels").click();
    await expect(page.getByTestId("plan-version")).toHaveText("v3");
    await expect(rows.first()).toHaveAttribute("data-testid", "rank-row-instagram_reels");
    await expect(rows.first()).toHaveAttribute("data-priority", "1");
  });

  test("mobile: rows stack as cards without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs/run_aclinic_demo/direction");
    await expect(page.getByTestId("rank-row-instagram_reels")).toBeVisible();
    await expect(page.getByTestId("notnow-row-meta_ads")).toContainText("LegitScript");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
  });

  test("a run without a plan yet says so and links back to the cockpit", async ({ page }) => {
    // a fresh mock run is still in research when the page opens
    await page.goto("/brands/hound");
    await page.getByTestId("start-run").click();
    await expect(page).toHaveURL(/\/runs\/run_hound_m\d+$/);
    // client-side navigation: the mock run only exists in this page load
    await page.getByRole("navigation", { name: "Run" }).getByRole("link", { name: "Direction" }).click();
    await expect(page).toHaveURL(/\/direction$/);
    await expect(page.getByTestId("direction-empty")).toContainText("Direction is not decided yet");
    await expect(page.getByRole("link", { name: "Back to the cockpit" })).toBeVisible();
  });
});
