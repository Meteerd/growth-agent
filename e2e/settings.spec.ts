import { expect, test } from "@playwright/test";
import { PROVIDER_IDS, PROVIDER_INFO } from "@/contracts";

test.describe("settings / providers", () => {
  test("every provider is on the grid and the empty ledger explains itself", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What runs live");
    const grid = page.getByTestId("provider-grid");
    await expect(grid).toBeVisible();
    for (const id of PROVIDER_IDS) {
      const tile = grid.getByTestId(`provider-${id}`);
      await expect(tile.getByRole("heading", { name: PROVIDER_INFO[id].label, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("mode-panel")).toContainText("Mock");
    await expect(page.getByTestId("ledger-empty")).toContainText("No paid calls yet");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
  });
});
