import { expect, test } from "@playwright/test";

// Live only (E2E_DATA=live): network trouble between the cockpit and the engine.
test.skip(process.env.E2E_DATA !== "live", "resilience runs against the real API routes");

test("engine down: the portfolio explains it and retries", async ({ page }) => {
  let down = true;
  await page.route("**/api/brands", (r) =>
    down
      ? r.fulfill({
          status: 500,
          contentType: "application/json",
          body: '{"error":{"code":"down","message":"engine offline"}}',
        })
      : r.continue(),
  );
  await page.goto("/brands");
  await expect(page.getByText("Could not reach the engine")).toBeVisible({ timeout: 15_000 });
  down = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("brand-card-hound")).toBeVisible();
});

test("slow network: the brand home shows a designed loading state first", async ({ page }) => {
  await page.route("**/api/brands/hound", async (r) => {
    await new Promise((res) => setTimeout(res, 1800));
    await r.continue();
  });
  await page.goto("/brands/hound");
  await expect(page.locator(".skeleton").first()).toBeVisible();
  await expect(page.getByTestId("dossier")).toBeVisible({ timeout: 15_000 });
});

test("the run stream drops once and reconnects", async ({ page }) => {
  let first = true;
  await page.route("**/api/runs/run_hound_demo/events**", (r) => {
    if (first) {
      first = false;
      return r.abort("connectionreset");
    }
    return r.continue();
  });
  await page.goto("/runs/run_hound_demo");
  await expect(page.getByTestId("event-stream")).toContainText("Run started", { timeout: 20_000 });
  await expect(page.getByTestId("evidence-wall")).toBeVisible();
});
