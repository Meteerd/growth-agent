import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

// Camplan creative batch (Mete, 12:00): filter, approve, download the approved ones with manifest.csv.
// Mock mode; the creatives route is stubbed here until Lane A serves it on the demo laptop.
const BATCH = [
  {
    id: "c1",
    name: "CP_VID_hook-a_calm_owner_en_v1",
    format: "video",
    hook: "myth",
    emotion: "calm",
    persona: "owner",
    language: "en",
    review: 81,
    url: "/media/sample.mp4",
  },
  {
    id: "c2",
    name: "CP_VID_hook-b_urgent_owner_en_v2",
    format: "video",
    hook: "question",
    emotion: "urgent",
    persona: "owner",
    language: "en",
    review: 74,
    url: "/media/sample.mp4",
  },
  {
    id: "c3",
    name: "CP_STA_hook-a_calm_pro_en_v1",
    format: "static",
    hook: "myth",
    emotion: "calm",
    persona: "pro",
    language: "en",
    review: 69,
    url: "/showcase/posters/hound.jpg",
  },
  {
    id: "c4",
    name: "CP_CAR_hook-c_proud_pro_en_v1",
    format: "carousel",
    hook: "list",
    emotion: "proud",
    persona: "pro",
    language: "en",
    url: "/showcase/carousels/hound/slide_1.jpg",
    slides: ["/showcase/carousels/hound/slide_1.jpg", "/showcase/carousels/hound/slide_2.jpg"],
  },
];

test("creative batch: filter, approve, download for a Meta test", async ({ page }) => {
  await page.route("**/api/brands/*/creatives", (r) => r.fulfill({ json: BATCH }));
  await page.goto("/brands/new");
  await page.getByLabel("Brand website").fill("camplan-test.com");
  await page.getByRole("button", { name: "Add brand" }).click();
  await expect(page.getByTestId("intake-done")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to portfolio" }).click();
  await page.locator('[data-testid^="brand-card-camplan"]').first().click();

  const batch = page.getByTestId("creative-batch");
  await expect(batch.getByTestId("batch-item")).toHaveCount(4);
  await batch.getByRole("button", { name: "static", exact: true }).click();
  await expect(batch.getByTestId("batch-item")).toHaveCount(1);
  await batch.getByRole("button", { name: "static", exact: true }).click();
  await expect(batch.getByTestId("batch-item")).toHaveCount(4);

  await batch.getByTestId("batch-item").nth(0).getByRole("button", { name: "Approve" }).click();
  await batch.getByTestId("batch-item").nth(3).getByRole("button", { name: "Approve" }).click();
  await batch.getByTestId("batch-item").nth(1).getByRole("button", { name: "Reject" }).click();
  await expect(batch).toContainText("2 approved, 1 rejected");

  const dl = page.waitForEvent("download");
  await batch.getByTestId("batch-download").click();
  const file = await (await dl).path();
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const manifest = strFromU8(zip["manifest.csv"]).trim().split("\n");
  expect(manifest).toHaveLength(1 + 1 + 2); // header, the video, two carousel slides
  expect(Object.keys(zip)).toContain("CP_VID_hook-a_calm_owner_en_v1.mp4");
  expect(Object.keys(zip)).toContain("CP_CAR_hook-c_proud_pro_en_v1_slide2.jpg");
});
