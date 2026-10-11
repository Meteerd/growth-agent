import { expect, type Page, test } from "@playwright/test";

// Mock state lives in the page, so every step runs in the same page load through window.__nexusClient.
async function postAndMeasure(page: Page, views?: number) {
  await page.evaluate(async (v) => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook exposed by the mock client
    const c = (window as any).__nexusClient;
    const packs = await c.packs("run_hound_demo");
    if (packs[0].status !== "posted")
      await c.markPosted(packs[0].id, { postedUrl: "https://www.tiktok.com/@hound/video/1" });
    if (v != null) await c.addMetrics(packs[0].id, { views: v });
  }, views);
}

test.describe("results", () => {
  test("honest empty state, then live counters and the views chart as snapshots land", async ({ page }) => {
    await page.goto("/brands/hound/results");
    await expect(page.getByText("Waiting for first metrics")).toBeVisible();
    await expect(page.getByTestId("results-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Hound" })).toHaveAttribute("href", "/brands/hound");
    await expect(page.getByTestId("results-totals")).toHaveCount(0);

    await postAndMeasure(page, 1200);
    await page.getByTestId("results-refresh").click();
    const chart = page.getByTestId("views-chart");
    await expect(chart).toBeVisible();
    await expect(page.getByTestId("pack-views")).toHaveText("1,200");
    await expect(page.getByTestId("total-views")).toHaveText("1,200");
    await expect(chart.getByTestId("chart-point")).toHaveCount(1);
    await expect(page.getByTestId("snapshot-count")).toHaveText("1 snapshot");
    await expect(page.getByTestId("posted-link")).toHaveAttribute("href", "https://www.tiktok.com/@hound/video/1");
    await expect(page.getByTestId("pack-likes")).toContainText("not recorded");

    await postAndMeasure(page, 3214);
    await page.getByTestId("results-refresh").click();
    await expect(page.getByTestId("pack-views")).toHaveText("3,214");
    await expect(page.getByTestId("total-views")).toHaveText("3,214");
    await expect(chart.getByTestId("chart-point")).toHaveCount(2);
    await expect(page.getByTestId("snapshot-count")).toHaveText("2 snapshots");

    // keyboard reads each snapshot
    await chart.focus();
    await page.keyboard.press("Home");
    await expect(chart).toHaveAttribute("aria-valuetext", /^1,200 views/);
    await page.keyboard.press("End");
    await expect(chart).toHaveAttribute("aria-valuetext", /^3,214 views/);
    await expect(page.getByTestId("learnings-empty")).toBeVisible();
  });

  test("a posted pack with no snapshots says it is waiting, not zero", async ({ page }) => {
    await page.goto("/brands/hound/results");
    await expect(page.getByTestId("results-empty")).toBeVisible();
    await postAndMeasure(page);
    await page.getByTestId("results-refresh").click();
    await expect(page.getByTestId("chart-waiting")).toBeVisible();
    await expect(page.getByTestId("views-chart")).toHaveCount(0);
    await expect(page.getByTestId("pack-views")).toContainText("not recorded");
  });
});
