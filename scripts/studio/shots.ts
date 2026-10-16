/**
 * Screenshots of the studio UI (visual QA on the server, no local browser).
 *   STUDIO_URL=https://... STUDIO_AUTH=user:pass tsx scripts/studio/shots.ts <outDir> [brand]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "/tmp/studio-shots";
const brand = process.argv[3] ?? "hound";
const base = process.env.STUDIO_URL ?? "http://127.0.0.1:3100";
const [username, password] = (process.env.STUDIO_AUTH ?? ":").split(":");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, httpCredentials: { username: username!, password: password! } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name: string) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("shot", name);
};
await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
await shot("01_home");
await page.goto(`${base}/studio/${brand}`, { waitUntil: "networkidle" });
await shot("02_ads");
const firstAd = page.locator("main button:has(img)").first();
if (await firstAd.count()) {
  await firstAd.click();
  await shot("03_ad_drawer");
  await page.keyboard.press("Escape");
}
for (const [i, tab] of ["Competitors", "Playbook", "Brand kit"].entries()) {
  await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
  await shot(`0${4 + i}_${tab.toLowerCase().replace(" ", "_")}`);
}
await page.goto(`${base}/studio/jobs`, { waitUntil: "networkidle" });
await shot("07_jobs");
console.log("console errors:", errors.slice(0, 5));
await browser.close();
