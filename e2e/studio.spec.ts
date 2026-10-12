import { expect, test } from "@playwright/test";

test("approve shots and render a draft; the player shows the video", async ({ page }) => {
  await page.goto("/runs/run_hound_demo/studio");
  await page.getByTestId("concept-concept_hound_2").click();
  const wb = page.getByTestId("workbench");
  await expect(wb).toContainText("What your dog thinks when you grab your keys");
  await expect(page.getByTestId("render")).toBeDisabled();
  await expect(page.getByTestId("render-hint")).toContainText("Approve every shot first");
  // approve one shot by hand, then the rest
  await page.getByTestId("shot-0").getByRole("button", { name: "approve" }).click();
  await expect(page.getByTestId("shot-0")).toHaveAttribute("data-approved", "true");
  await page.getByTestId("approve-all").click();
  await expect(page.getByTestId("approve-all")).toHaveText("All shots approved");
  await page.screenshot({ path: "e2e/screens/studio-desktop.png" });
  await page.getByTestId("render").click();
  await expect(page.getByTestId("render")).toContainText("Rendering");
  await expect(page.getByTestId("render-hint")).toContainText("Rendered", { timeout: 15_000 });
  await expect(page.locator("video")).toHaveAttribute("src", /\.mp4/);
});

test("text posts show the post as it will read", async ({ page }) => {
  await page.goto("/runs/run_hound_demo/studio");
  await page.getByTestId("concept-concept_hound_6").click();
  await expect(page.getByTestId("post-preview")).toContainText("/ 280");
  await expect(page.getByTestId("compliance")).toBeVisible();
});

// B22: revise by chat with a clarifying question, a new version, compare two versions, use the new one.
test("revise by chat, compare versions, use the new one", async ({ page }) => {
  await page.goto("/runs/run_hound_demo/studio");
  const revise = page.getByTestId("revise");
  await expect(revise).toBeVisible();
  await revise.getByRole("button", { name: "Bigger hook text" }).click();
  const q = page.getByTestId("revise-question");
  await expect(q).toBeVisible();
  await q.getByRole("button", { name: "Only the hook text" }).click();
  await expect(q).toBeHidden();
  const strip = page.getByTestId("version-strip");
  await expect(strip.locator("li")).toHaveCount(2);
  await expect(strip.locator("li").nth(1)).toContainText("review pending", { timeout: 10_000 });
  await page.getByTestId("compare-toggle").click();
  await expect(page.getByTestId("version-players").locator("figure")).toHaveCount(2);
  await page.getByTestId("use-version").click();
  await expect(strip.locator("li").nth(1)).toContainText("in use");
  await page.getByRole("button", { name: /pick takes per shot/i }).click();
  await expect(page.getByTestId("takes").getByText("fal").first()).toBeVisible();
});
