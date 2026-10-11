import { expect, test } from "@playwright/test";

test.describe("reverse-engineer view", () => {
  test("open a blueprint, scrub the timeline, see the aligned remake with review scores", async ({ page }) => {
    await page.goto("/runs/run_hound_demo");
    await page.getByTestId("blueprint-bp_hound_1").click();
    await expect(page).toHaveURL(/\/runs\/run_hound_demo\/blueprints\/bp_hound_1$/);
    const view = page.getByTestId("blueprint-view");
    await expect(view).toBeVisible();
    // the remake is aligned shot for shot and carries the self-review score per shot
    const shots = await page.locator('[data-testid^="bp-shot-"]').count();
    expect(shots).toBeGreaterThan(3);
    await expect(page.locator('[data-testid^="remake-shot-"]')).toHaveCount(shots);
    await expect(page.getByTestId("remake-score-0")).toBeVisible();
    await expect(page.getByTestId("rewatch")).toBeEnabled({ timeout: 10_000 }); // the first sweep finished
    await page.screenshot({ path: "e2e/screens/blueprint-desktop.png" });

    // scrub: click near the end of the track, then step back with the keyboard
    const track = page.getByTestId("timeline");
    const box = (await track.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.95, box.y + 60);
    await expect(page.getByTestId(`bp-shot-${shots - 1}`)).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("their-shot")).toContainText("cta", { ignoreCase: true });
    await track.press("ArrowLeft");
    await expect(page.getByTestId(`bp-shot-${shots - 2}`)).toHaveAttribute("data-active", "true");
    await track.press("Home");
    await expect(page.getByTestId("bp-shot-0")).toHaveAttribute("data-active", "true");

    await expect(page.getByTestId("hook")).toContainText("why it stops the scroll");
    await expect(page.getByTestId("self-review")).toContainText("round 2");
    await page.getByRole("button", { name: "round 1" }).click();
    await expect(page.getByTestId("self-review")).toContainText("Regenerate");
    await expect(page.getByTestId("variant").first()).toBeVisible();
  });

  test("mobile keeps the page width and scrolls the timeline inside its panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs/run_hound_demo/blueprints/bp_hound_1");
    await expect(page.getByTestId("blueprint-view")).toBeVisible();
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: "e2e/screens/blueprint-mobile.png" });
  });

  test("unknown blueprint shows a designed empty state", async ({ page }) => {
    await page.goto("/runs/run_hound_demo/blueprints/bp_nope");
    await expect(page.getByText("No blueprint with this id")).toBeVisible();
  });
});
