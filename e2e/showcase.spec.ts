import { expect, type Page, test } from "@playwright/test";

// B21: the public read-only build (NEXT_PUBLIC_DATA_MODE=showcase, no keys, fresh database). See deploy/README.md.
test.skip(process.env.E2E_READONLY !== "1", "runs against the read-only production build only");

type Brand = { slug: string; heroVideo?: { runId: string } };

async function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));
  return problems;
}

test("every change is refused with a clear read-only message", async ({ request }) => {
  const spendBefore = await (await request.get("/api/spend")).text();
  const attempts = [
    request.post("/api/brands", { data: { url: "https://example.com" } }),
    request.post("/api/brands/hound/runs", { data: { kind: "full", reuseResearchFrom: "recorded" } }),
    request.patch("/api/brands/brand_hound/dossier", { data: { oneLiner: "x" } }),
    request.post("/api/packs/pack_1d68be0a_1/posted", { data: { postedUrl: "https://www.tiktok.com/@x/video/1" } }),
    request.post("/api/packs/pack_1d68be0a_1/metrics", { data: { views: 1000 } }),
    request.post("/api/packs/pack_1d68be0a_1/landing", { data: {} }),
    request.post("/api/runs/run_mv4e0ud7671d68be0a/chat", { data: { message: "hi" } }),
    request.post("/api/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/list" } }),
  ];
  for (const res of await Promise.all(attempts)) {
    expect(res.status(), res.url()).toBe(403);
    expect((await res.json()).error.code).toBe("read_only");
  }
  expect(await (await request.get("/api/spend")).text()).toBe(spendBefore);
});

test("every screen of the four showcase runs renders without an error", async ({ page }) => {
  test.setTimeout(400_000);
  const brands: Brand[] = await (await page.request.get("/api/brands")).json();
  expect(brands.length).toBe(4);
  const routes = ["/", "/brands", "/settings"];
  for (const b of brands) {
    routes.push(`/brands/${b.slug}`, `/brands/${b.slug}/connect`, `/brands/${b.slug}/results`);
    const run = b.heroVideo?.runId;
    expect(run, `${b.slug} has a flagship run`).toBeTruthy();
    for (const s of ["", "/consult", "/direction", "/studio", "/packs"]) routes.push(`/runs/${run}${s}`);
    const bps: { id: string }[] = await (await page.request.get(`/api/runs/${run}/blueprints`)).json();
    for (const bp of bps) routes.push(`/runs/${run}/blueprints/${bp.id}`);
  }
  const problems = await watch(page);
  for (const r of routes) {
    await page.goto(r);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(/something went wrong|could not load/i), r).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});

test("a visitor pressing Start a run gets the read-only message, not a crash", async ({ page }) => {
  const problems = await watch(page);
  await page.goto("/brands/hound");
  await expect(page.getByText("Read-only showcase")).toBeVisible();
  const start = page.getByRole("button", { name: /start a run/i }).first();
  if (await start.count()) {
    await start.click();
    await expect(page.getByText(/Live runs happen in the operator app/).first()).toBeVisible();
  }
  expect(problems.filter((p) => !p.includes("403"))).toEqual([]);
});
