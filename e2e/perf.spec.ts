import { expect, test } from "@playwright/test";

// B03: the field shader must never block interaction. Measures long tasks after load on the landing page.
test("landing: no long task over 200 ms after load", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: { start: number; dur: number }[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: "longtask", buffered: true });
  });
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForSelector('[data-field="ready"]', { timeout: 15_000 });
  await page.mouse.move(400, 300);
  await page.mouse.move(900, 500, { steps: 20 });
  await page.waitForTimeout(3000);
  const { tasks, loadEnd } = await page.evaluate(() => ({
    tasks: (window as unknown as { __long: { start: number; dur: number }[] }).__long,
    loadEnd: performance.getEntriesByType("navigation")[0]
      ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).loadEventEnd
      : 0,
  }));
  const after = tasks.filter((t) => t.start >= loadEnd);
  console.log(
    `longtasks total=${tasks.length} afterLoad=${after.length} maxAfterLoad=${Math.max(0, ...after.map((t) => Math.round(t.dur)))}ms`,
  );
  expect(after.every((t) => t.dur <= 200)).toBe(true);
});
