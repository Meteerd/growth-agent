import { expect, type Page, test } from "@playwright/test";

/** Answers the visible consultation question, then waits until the next one (or the summary) replaced it. */
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
    await q.getByRole("textbox").fill("A few static posts in spring, no traction.");
    await q.getByTestId("answer").click();
  }
  await expect(async () => {
    const done = await page.getByTestId("consult-done").isVisible();
    const now = done ? "" : await q.locator(".mono-label").first().innerText();
    expect(done || now !== label).toBe(true);
  }).toPass({ timeout: 10_000 });
}

// B16: the whole loop in one browser session (mock state lives for one page load, so every step is a client navigation).
test("full journey: brand, run, consult, reverse-engineer, direction, studio, packs, results", async ({ page }) => {
  test.setTimeout(240_000);
  const tab = (name: string) => page.getByRole("navigation", { name: "Run" }).getByRole("link", { name });

  // enter: landing to portfolio to brand
  await page.goto("/");
  await page.getByRole("link", { name: "portfolio of four live brands" }).click();
  await expect(page.getByTestId("brand-card-hound")).toBeVisible();
  await page.getByTestId("brand-card-hound").click();
  await expect(page.getByTestId("dossier")).toBeVisible();

  // run: the cockpit streams evidence and blueprints, then pauses for the operator
  await page.getByTestId("start-run").click();
  await expect(page).toHaveURL(/\/runs\/run_hound_m\d+$/);
  await expect(page.getByTestId("evidence-wall")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("needs-you")).toBeVisible({ timeout: 40_000 });

  // consult: every question answered or skipped, the run resumes and finishes
  await page.getByRole("link", { name: "Start the consultation" }).click();
  await expect(page.getByTestId("question")).toBeVisible();
  await page.getByTestId("skip").click();
  for (let i = 0; i < 10 && !(await page.getByTestId("consult-done").isVisible()); i++) await answerCurrent(page);
  await expect(page.getByTestId("consult-done")).toBeVisible();
  await expect(page.getByTestId("run-done")).toBeVisible({ timeout: 40_000 });

  // reverse-engineer: the winner and our remake, aligned
  await page.locator('[data-testid^="blueprint-bp_"]').first().click();
  await expect(page.getByTestId("blueprint-view")).toBeVisible();
  await expect(page.locator('[data-testid^="remake-shot-"]').first()).toBeVisible();
  await expect(page.getByTestId("remake-score-0")).toBeVisible();

  // direction: orbit and list, evidence behind a channel
  await tab("Direction").click();
  await expect(page.getByTestId("orbit-map")).toBeVisible();
  await page.getByTestId("orbit-body-tiktok").focus(); // bodies drift on their orbits; the keyboard path is stable
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "TikTok" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Ranked list" }).click();
  await expect(page.getByTestId("ranked-list")).toBeVisible();

  // studio: approve the storyboard and render a draft
  await tab("Studio").click();
  await expect(page.getByTestId("workbench")).toBeVisible();
  await page.getByTestId("approve-all").click();
  await expect(page.getByTestId("approve-all")).toHaveText("All shots approved");
  await page.getByTestId("render").click();
  await expect(page.getByTestId("render-hint")).toContainText("Rendered", { timeout: 15_000 });

  // packs: mark one posted and enter its first numbers
  await tab("Packs").click();
  const card = page.locator('[data-testid^="pack-card-"]').first();
  await card.getByTestId("pack-mark-posted").click();
  const posted = page.getByRole("dialog", { name: "Mark as posted" });
  await posted.getByLabel("Post URL").fill("https://www.tiktok.com/@hound/video/7311111111111111111");
  await posted.getByRole("button", { name: "Save" }).click();
  await expect(card.getByTestId("pack-status")).toHaveAttribute("data-state", "posted");
  await card.getByTestId("pack-enter-metrics").click();
  const metrics = page.getByRole("dialog", { name: "Enter metrics" });
  await metrics.getByLabel("views").fill("3214");
  await metrics.getByRole("button", { name: "Save metrics" }).click();
  await expect(card.getByTestId("pack-metrics")).toContainText("3,214");

  // results: the number shows up where the brand's results live
  await page.getByRole("link", { name: "Hound" }).first().click();
  await page.getByRole("navigation", { name: "Brand" }).getByRole("link", { name: "Results" }).click();
  await expect(page.getByTestId("pack-views")).toHaveText("3,214");
  await expect(page.getByTestId("views-chart")).toBeVisible();
});
