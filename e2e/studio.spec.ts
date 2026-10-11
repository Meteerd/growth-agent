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
