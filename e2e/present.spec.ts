import { expect, test } from "@playwright/test";

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
