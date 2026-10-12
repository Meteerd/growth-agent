import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { DEMO_PATH } from "../src/lib/client/demoPath";
import { localMedia } from "../src/lib/client/media";

// Offline demo proof: the whole pitch path with every non-localhost request refused, in the browser and in the server.
// Server: NODE_OPTIONS="--require ./e2e/offline-net.cjs" (logs refused sockets to logs/offline-blocked.log). See demo/README.md.
test.skip(process.env.E2E_DATA !== "live", "the offline proof runs against the real API routes");

const BLOCKED_LOG = "logs/offline-blocked.log";
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

async function offline(page: Page) {
  const remote: string[] = [];
  const errors: string[] = [];
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "data:" || u.protocol === "blob:" || LOCAL.test(u.hostname)) return route.continue();
    remote.push(u.href);
    return route.abort("internetdisconnected");
  });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return { remote, errors };
}

/** Images that are visible but failed to decode (a broken icon on stage). */
const brokenImages = (page: Page) =>
  page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
      .map((i) => i.currentSrc || i.src),
  );

async function playing(page: Page, selector = "video") {
  await expect
    .poll(
      () =>
        page.evaluate(
          (sel) =>
            [...document.querySelectorAll<HTMLVideoElement>(sel)].some(
              (v) => v.readyState >= 2 && v.currentTime > 0.2 && !v.paused,
            ),
          selector,
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

// Phase 1 (online server, E2E_WARM=1): fill the local cover cache for every real run, like a rehearsal would.
test("warm the local cover cache", async ({ request }) => {
  test.skip(process.env.E2E_WARM !== "1", "only before the offline phase");
  test.setTimeout(300_000);
  const urls = new Set<string>();
  for (const b of await (await request.get("/api/brands")).json())
    for (const r of await (await request.get(`/api/brands/${b.slug}/runs`)).json())
      if (!r.demo)
        for (const e of await (await request.get(`/api/runs/${r.id}/evidence`)).json())
          if (e.thumbnailUrl) urls.add(localMedia(e.thumbnailUrl));
  const list = [...urls];
  for (let i = 0; i < list.length; i += 12)
    await Promise.all(list.slice(i, i + 12).map((u) => request.get(u).catch(() => undefined)));
  expect(list.length).toBeGreaterThan(50);
});

// Phase 2 (server started with the offline preload): the pitch path, nothing leaves localhost.
const EXTRA = [
  { label: "Landing", href: "/" },
  { label: "Brand home", href: "/brands/hound" },
];

test("offline: the pitch path works from localhost only", async ({ page }) => {
  test.skip(process.env.E2E_WARM === "1", "warm phase only");
  test.setTimeout(300_000);
  fs.rmSync(BLOCKED_LOG, { force: true });
  // compile every route first: a dev server's first compile can reload the page mid-check
  for (const step of [...EXTRA, ...DEMO_PATH]) expect((await page.request.get(step.href)).ok()).toBe(true);
  const { remote, errors } = await offline(page);

  for (const step of [...EXTRA, ...DEMO_PATH]) {
    await test.step(step.label, async () => {
      await page.goto(`${step.href}${step.href.includes("?") ? "&" : "?"}present=1`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle").catch(() => {});
      if (step.label === "Portfolio") {
        await expect(page.locator('[data-testid^="brand-card-"]')).toHaveCount(4);
        await playing(page);
      }
      if (step.label === "The run") await expect(page.getByTestId("manus-findings")).toBeVisible();
      if (step.label === "Reverse-engineer") {
        await expect(page.getByTestId("blueprint-view")).toBeVisible();
        await playing(page);
      }
      if (step.label === "Packs") {
        const zip = page.waitForEvent("download");
        await page.getByTestId("pack-download").first().click();
        expect((await zip).suggestedFilename()).toMatch(/\.zip$/);
      }
      expect(await brokenImages(page), `broken images on ${step.href}`).toEqual([]);
      const fonts = await page.evaluate(() =>
        [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
      );
      expect(fonts.map((f) => f.replaceAll('"', ""))).toContain("Inter Tight");
    });
  }

  expect(remote, "requests that left localhost").toEqual([]);
  expect(errors, "console errors").toEqual([]);
  const blocked = fs.existsSync(BLOCKED_LOG) ? fs.readFileSync(BLOCKED_LOG, "utf8").trim() : "";
  // registry.npmjs.org is next dev's own version check (it ignores the failure); anything else is our code going online
  expect(
    blocked.split("\n").filter((l) => l && !l.endsWith("registry.npmjs.org")),
    "server lookups refused",
  ).toEqual([]);
});
