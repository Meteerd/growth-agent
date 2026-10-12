import { expect, test } from "@playwright/test";
import { DEMO_PATH } from "../src/lib/client/demoPath";

// BS1: presentation mode hides dev chrome, scales the page and offers replay speeds on a finished run.
test("presentation mode", async ({ page }) => {
  await page.goto("/runs/run_hound_demo?present=1");
  await expect(page.locator("html")).toHaveAttribute("data-present", "1");
  await expect(page.getByText("Mock data")).toBeHidden();
  await expect(page.getByTestId("replay-speed")).toBeVisible();
  await page.getByTestId("replay-speed").getByRole("button", { name: "4x" }).click();
  await expect(page.getByTestId("event-stream")).toContainText("Run started");
  // the flag survives client navigation and turns off with ?present=0
  await page.getByRole("link", { name: "Portfolio" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-present", "1");
  await page.goto("/brands?present=0");
  await expect(page.locator("html")).not.toHaveAttribute("data-present", "1");
  await expect(page.getByText("Mock data")).toBeVisible();
});

// Event goal 5: keys jump between the pitch screens in order; 0 starts the 2-minute auto-play, Esc stops it.
test("presentation keys follow the pitch path", async ({ page }) => {
  await page.goto("/brands?present=1");
  await expect(page.locator("html")).toHaveAttribute("data-present", "1");
  await page.keyboard.press("3");
  await expect(page).toHaveURL(new RegExp(`${DEMO_PATH[2].href}$`));
  await expect(page.getByTestId("pitch-hud")).toContainText(`3/${DEMO_PATH.length}`);
  await page.keyboard.press("]");
  await expect(page).toHaveURL(new RegExp(`${DEMO_PATH[3].href}$`));
  await page.keyboard.press("PageUp");
  await expect(page).toHaveURL(new RegExp(`${DEMO_PATH[2].href}$`));
  await page.keyboard.press("0");
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByTestId("pitch-hud")).toContainText(DEMO_PATH[0].label);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pitch-hud")).toBeHidden();
});
