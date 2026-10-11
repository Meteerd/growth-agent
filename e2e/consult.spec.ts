import { expect, type Page, test } from "@playwright/test";

/** Answers the visible question, then waits until the next one (or the summary) has replaced it. */
async function answerCurrent(page: Page) {
  const q = page.getByTestId("question");
  const label = await q.locator(".mono-label").first().innerText();
  const kind = await q.getAttribute("data-kind");
  if (kind === "single" || kind === "confirm") await q.getByRole("radio").first().click();
  else if (kind === "multi") {
    await q.getByRole("button", { pressed: false }).first().click();
    await q.getByTestId("answer").click();
  } else if (kind === "scale") await q.getByTestId("answer").click();
  else {
    await q.getByRole("textbox").fill("Two static posts in spring, no traction.");
    await q.getByTestId("answer").click();
  }
  await expect(async () => {
    const done = await page.getByTestId("consult-done").isVisible();
    const now = done ? "" : await page.getByTestId("question").locator(".mono-label").first().innerText();
    expect(done || now !== label).toBe(true);
  }).toPass({ timeout: 10_000 });
}

test("answer every question in mock mode and the run resumes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/brands/hound");
  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("needs-you")).toBeVisible({ timeout: 40_000 });
  await page.getByRole("link", { name: "Start the consultation" }).click();
  await expect(page.getByTestId("question")).toBeVisible();
  await expect(page.getByTestId("evidence-chips")).toBeVisible();
  await page.screenshot({ path: "e2e/screens/consult-desktop.png" });
  // first question answered, the second skipped with its stated assumption, the rest answered
  await answerCurrent(page);
  await expect(page.getByTestId("question")).toContainText("question 2 of");
  await page.getByTestId("skip").click();
  await expect(page.getByTestId("question")).toContainText("question 3 of");
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId("consult-done").isVisible()) break;
    await answerCurrent(page);
  }
  await expect(page.getByTestId("consult-done")).toBeVisible();
  await expect(page.getByTestId("consult-done")).toContainText("skipped");
  // auto-returns to the cockpit and the run finishes
  await expect(page.getByTestId("run-done")).toBeVisible({ timeout: 40_000 });
});

test("chat drawer streams a reply", async ({ page }) => {
  await page.goto("/runs/run_hound_demo/consult");
  await page.getByTestId("chat-open").click();
  await page.getByLabel("Message").fill("We tried Reels in spring");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("chat-log")).toContainText("Mock mode", { timeout: 10_000 });
});
