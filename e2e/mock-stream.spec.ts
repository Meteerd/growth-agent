import { expect, test } from "@playwright/test";
import { DEMO_RUNS } from "@/contracts";

// B05: the dev page plays the full scripted mock run, pauses at consult, resumes on answers.
test("mock stream plays a full run with the consult pause", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/lab/stream");
  await page.getByTestId("stream-start").click();
  await expect(page.getByTestId("stream-answer")).toBeVisible({ timeout: 70_000 });
  await page.getByTestId("stream-answer").click();
  const total = DEMO_RUNS.hound.events.length;
  await expect(page.getByTestId("stream-count")).toHaveText(`${total} events, ended: done`, { timeout: 70_000 });
});
