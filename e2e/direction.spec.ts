import { expect, test } from "@playwright/test";

// Mock mode: state lives for one page load, so the edits stay on a single load.
test.describe("direction", () => {
  test("orbit and list views, evidence drawer, drop and reorder write new plan versions", async ({ page }) => {
    await page.goto("/runs/run_hound_demo/direction");
    await expect(page.getByTestId("plan-version")).toHaveText("v1");
    await expect(page.getByTestId("plan-weights")).toContainText("25%");

    // orbit: bodies are real buttons with spoken names; focus inspects, Enter opens the evidence drawer
    const map = page.getByTestId("orbit-map");
    await expect(map).toBeVisible();
    const tiktok = page.getByTestId("orbit-body-tiktok");
    await expect(tiktok).toHaveAccessibleName(/^TikTok, score \d+, priority 1/);
    await expect(page.getByTestId("notnow-body-linkedin")).toBeVisible();

    await page.getByTestId("orbit-body-instagram_reels").focus();
    await expect(page.getByTestId("inspect-card")).toHaveAttribute("data-channel", "instagram_reels");
    await expect(page.getByTestId("inspect-card").getByRole("img", { name: /six axes/ })).toBeVisible();

    await page.getByTestId("notnow-body-linkedin").focus();
    await expect(page.getByTestId("inspect-text")).toContainText("LinkedIn");

    await tiktok.focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "TikTok" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("evidence-drawer")).toContainText("First steps");
    await expect(drawer.locator("article[data-source]").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // ranked list: drop a channel with a reason, it moves to Not now and the plan becomes v2
    await page.getByRole("tab", { name: "Ranked list" }).click();
    await expect(page.getByTestId("ranked-list")).toBeVisible();
    await expect(map).toBeHidden();
    await expect(page.getByTestId("rank-row-meta_ads")).toBeVisible();

    await page.getByTestId("rank-drop-meta_ads").click();
    const dialog = page.getByRole("dialog", { name: "Drop Meta paid?" });
    await dialog.getByLabel("Reason (optional)").fill("No ad budget this month");
    await dialog.getByLabel("Reason (optional)").press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("rank-row-meta_ads")).toHaveCount(0);
    await expect(page.getByTestId("notnow-row-meta_ads")).toContainText("No ad budget this month");
    await expect(page.getByTestId("plan-version")).toHaveText("v2");

    // reorder: move the second pick up, it becomes priority 1 in v3
    await page.getByTestId("rank-up-instagram_reels").click();
    await expect(page.getByTestId("plan-version")).toHaveText("v3");
    await expect(page.locator('[data-testid^="rank-row-"]').first()).toHaveAttribute(
      "data-testid",
      "rank-row-instagram_reels",
    );

    // back to the orbit: the dropped channel now sits outside the rings
    await page.getByRole("tab", { name: "Orbit" }).click();
    await expect(page.getByTestId("notnow-body-meta_ads")).toBeVisible();
    await expect(page.getByTestId("orbit-body-instagram_reels")).toHaveAccessibleName(/priority 1/);
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
