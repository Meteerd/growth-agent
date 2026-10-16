import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FORMATS } from "../studio/formats";
import { contrast, renderSlide } from "../studio/render/templates";
import { clean, fit, fitBox } from "../studio/render/type";
import { libraryUrl, winnerScore } from "../studio/scan";
import { type Slide, type StudioBrandConfig, TEMPLATES } from "../studio/types";

const cfg: StudioBrandConfig = {
  countries: ["SK"],
  languages: ["sk"],
  defaultLanguage: "sk",
  competitors: [],
  searchTerms: [],
  placement: "paid",
  imageModel: "fal:gpt-image-2.5-flare",
  aspects: ["4:5"],
  brandImages: [],
  colors: { primary: "#1E5EFF", accent: "#1E5EFF", ink: "#14161A", paper: "#F7F5F0" },
  fonts: { head: "jakarta", body: "inter" },
  notes: [],
  testimonials: [],
  disclaimers: [],
  ctaUrl: "a.clinic",
};

describe("studio winner score", () => {
  it("ranks long-running, scaled, live creatives highest", () => {
    expect(winnerScore(120, 12, true)).toBeGreaterThan(winnerScore(120, 1, true));
    expect(winnerScore(120, 1, true)).toBeGreaterThan(winnerScore(10, 1, true));
    expect(winnerScore(180, 30, true)).toBe(100);
    expect(winnerScore(undefined, undefined, false)).toBeGreaterThanOrEqual(0);
  });
  it("builds Ad Library URLs for a page or a keyword", () => {
    expect(libraryUrl({ country: "SK", pageId: "123" })).toContain("view_all_page_id=123");
    expect(libraryUrl({ country: "SK", q: "chudnutie lekár" })).toContain("q=chudnutie+lek");
  });
});

describe("studio type", () => {
  it("strips emoji and em dashes", () => {
    expect(clean("Ahoj 👋 svet — teraz")).toBe("Ahoj svet, teraz");
  });
  it("fits a headline within its line budget", () => {
    const f = fit("jakarta", "Lekár môže povedať aj nie, a to je dobre", { max: 110, min: 40, maxW: 900, maxLines: 2 });
    expect(f.lines.length).toBeLessThanOrEqual(2);
  });
  it("keeps a block inside a height", () => {
    const f = fitBox("inter_bold", "Most struggles are skills your dog has not learned yet. Skills can be practised.", {
      max: 80,
      min: 20,
      maxW: 800,
      maxH: 200,
    });
    expect(f.lines.length * f.lineH).toBeLessThanOrEqual(200);
  });
});

describe("studio templates", () => {
  it("every format maps to a real template", () => {
    for (const f of FORMATS) expect(TEMPLATES).toContain(f.template);
  });
  it("renders every template to the right size with readable type (Slovak diacritics)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-"));
    const slots = {
      eyebrow: "Online starostlivosť",
      headline: "Lekár môže povedať aj nie",
      accentWord: "nie",
      body: "Krátky dotazník, videokonzultácia, lekár rozhodne.",
      bullets: ["Dotazník: asi 10 minút", "Videokonzultácia: s lekárom", "Kontroly: priebežne"],
      rows: [{ label: "Lekár", us: "Áno", them: "Nie" }],
      myth: "Stačí viac vôle.",
      fact: "Lekár sa pozrie na spánok, stres aj stravu.",
      quote: "Konečne ma niekto vypočul.",
      attribution: "Ukážka",
      stat: "10 min",
      statLabel: "trvá dotazník",
      price: "Konzultácia 29 €",
      cta: "Zistiť viac",
    };
    for (const t of TEMPLATES.filter((x) => x !== "native")) {
      const slide: Slide = { template: t, slots, image: { source: "none" } };
      const out = path.join(dir, `${t}.png`);
      const r = await renderSlide({ slide, aspect: "4:5", brand: { name: "a.clinic", config: cfg }, out });
      const m = await sharp(r.file).metadata();
      expect([m.width, m.height]).toEqual([1080, 1350]);
      expect(r.minContrast).toBeGreaterThanOrEqual(3);
    }
  }, 60_000);
  it("contrast helper matches WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
});
