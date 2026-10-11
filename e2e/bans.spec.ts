import { expect, test } from "@playwright/test";

// B18 self-audit: docs/DESIGN.md v2 "Hard bans", checked on computed styles of every element on every route.
const ROUTES = [
  "/",
  "/brands",
  "/brands/new",
  "/brands/hound",
  "/brands/hound/connect",
  "/brands/hound/results",
  "/runs/run_hound_demo",
  "/runs/run_hound_demo/consult",
  "/runs/run_hound_demo/direction",
  "/runs/run_hound_demo/studio",
  "/runs/run_hound_demo/packs",
  "/runs/run_hound_demo/blueprints/bp_hound_1",
  "/settings",
  "/lab",
];

for (const path of ROUTES) {
  test(`no banned v1 elements on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const hits = await page.evaluate(() => {
      const out: string[] = [];
      const near = (c: string, [r, g, b]: number[]) => {
        const m = c.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
        if (!m || (m[4] !== undefined && Number(m[4]) < 0.05)) return false;
        return Math.abs(+m[1] - r) + Math.abs(+m[2] - g) + Math.abs(+m[3] - b) < 40;
      };
      const name = (el: Element) =>
        `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || "").slice(0, 60)}`;
      if (document.querySelector("canvas")) out.push("canvas (shader)");
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const cs = getComputedStyle(el);
        const text = (el.textContent ?? "").trim().length > 0;
        if (cs.backdropFilter && cs.backdropFilter !== "none") out.push(`blur: ${name(el)}`);
        if (text && cs.fontStyle === "italic") out.push(`italic: ${name(el)}`);
        if (/instrument serif/i.test(cs.fontFamily)) out.push(`serif: ${name(el)}`);
        if (
          cs.backgroundClip === "text" ||
          (cs as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip === "text"
        )
          out.push(`gradient text: ${name(el)}`);
        for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor])
          if (near(c, [212, 255, 58])) out.push(`lime: ${name(el)}`);
        const floating = el.closest(
          '[role="dialog"],[role="tooltip"],[role="menu"],[data-radix-popper-content-wrapper],.toast',
        );
        if (!floating && cs.boxShadow !== "none") {
          for (const part of cs.boxShadow.split(/,(?![^(]*\))/)) {
            if (part.includes("inset")) continue;
            const px = part.match(/(-?[\d.]+)px/g)?.map((x) => Number.parseFloat(x)) ?? [];
            if ((px[2] ?? 0) > 0) out.push(`glow: ${name(el)} ${part.trim().slice(0, 50)}`);
          }
        }
        if (
          cs.animationIterationCount === "infinite" &&
          cs.animationName !== "none" &&
          !el.closest('[aria-busy="true"]')
        )
          out.push(`ambient animation ${cs.animationName}: ${name(el)}`);
      }
      return [...new Set(out)].slice(0, 20);
    });
    expect(hits, hits.join("\n")).toEqual([]);
  });
}
