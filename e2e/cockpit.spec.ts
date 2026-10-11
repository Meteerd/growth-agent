import { expect, test } from "@playwright/test";

test("a mock run streams to completion with every phase lit", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/brands/hound");
  await page.getByTestId("start-run").click();
  await expect(page).toHaveURL(/\/runs\/run_hound_m\d+$/);
  const runId = page.url().split("/").pop()!;
  await expect(page.getByTestId("event-stream")).toContainText("crawl_site");
  await expect(page.getByTestId("evidence-wall")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("needs-you")).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "e2e/screens/cockpit-midrun-desktop.png" });
  // answer through the same client the consult screen uses (the consult UI has its own spec)
  await page.evaluate(async (id) => {
    const c = (
      window as unknown as {
        __nexusClient: {
          questions: (id: string) => Promise<{ id: string; defaultAnswer?: unknown }[]>;
          answer: (id: string, r: unknown) => Promise<unknown>;
        };
      }
    ).__nexusClient;
    const qs = await c.questions(id);
    await c.answer(id, {
      answers: qs.map((q) => ({ questionId: q.id, value: q.defaultAnswer, skip: q.defaultAnswer == null })),
    });
  }, runId);
  await expect(page.getByTestId("run-done")).toBeVisible({ timeout: 40_000 });
  const rail = page.getByRole("list", { name: "Run phases" }).first();
  await expect(rail.locator('[data-state="done"]')).toHaveCount(9);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/cockpit-finished-desktop.png" });
});

test("a finished demo run can be replayed", async ({ page }) => {
  await page.goto("/runs/run_hound_demo");
  await expect(page.getByTestId("run-done")).toBeVisible();
  await page.getByTestId("replay").click();
  await expect(page.getByTestId("event-stream")).toContainText("Run started");
});
