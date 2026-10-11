import { z } from "zod";
import { type Brand, type BrandDossier, Persona, VERTICALS } from "@/contracts";
import { directFetch, type ScrapeResult, scrape } from "../../providers/firecrawl";
import { patchDossier, upsertBrand } from "../../repo";
import { rulePackText } from "../../rules";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";

export const DossierExtract = z.object({
  oneLiner: z.string(),
  positioning: z.string(),
  offers: z.array(z.object({ name: z.string(), price: z.string().optional(), notes: z.string().optional() })),
  personas: z.array(Persona),
  voice: z.object({ tone: z.string(), do: z.array(z.string()), dont: z.array(z.string()) }),
  proof: z.array(z.string()),
  claimsAllowed: z.array(z.string()),
  claimsForbidden: z.array(z.string()),
  colors: z.array(z.string()),
  fonts: z.array(z.string()),
  competitors: z.array(z.object({ name: z.string(), url: z.string() })),
  gaps: z.array(z.string()),
  vertical: z.enum(VERTICALS),
  countries: z.array(z.string()),
  languages: z.array(z.string()),
});
export type DossierExtract = z.infer<typeof DossierExtract>;

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const uniq = <T>(xs: T[], key: (x: T) => string = (x) => JSON.stringify(x).toLowerCase()) => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Crawl results only fill what is empty or was itself crawled before; curated and operator fields stay. */
export function mergeCrawl(d: BrandDossier, x: DossierExtract, page: ScrapeResult, at: string): Partial<BrandDossier> {
  const crawled = new Set((d.provenance ?? []).filter((p) => p.source === "crawl").map((p) => p.field));
  const take = <K extends keyof BrandDossier>(k: K, v: BrandDossier[K]) =>
    empty(d[k]) || crawled.has(k) ? { [k]: v } : {};
  const brandColors = page.branding?.colors
    ? uniq(
        Object.entries(page.branding.colors)
          .filter(([k]) => /primary|secondary|accent|background/i.test(k))
          .map(([, v]) => v.toUpperCase()),
      )
    : [];
  return {
    ...take("oneLiner", x.oneLiner),
    ...take("positioning", x.positioning),
    ...take("offers", x.offers),
    ...take("personas", x.personas),
    ...take("voice", x.voice),
    ...take("claimsAllowed", x.claimsAllowed),
    ...take("claimsForbidden", x.claimsForbidden),
    proof: uniq([...d.proof, ...x.proof]),
    competitors: uniq([...d.competitors, ...x.competitors], (c) => c.name.toLowerCase()),
    gaps: uniq([...d.gaps.filter((g) => !g.startsWith("Everything:")), ...x.gaps]).slice(0, 10),
    visual: {
      ...d.visual,
      colors: d.visual.colors.length ? d.visual.colors : uniq([...brandColors, ...x.colors]).slice(0, 6),
      fonts: d.visual.fonts?.length
        ? d.visual.fonts
        : uniq([...(page.branding?.fonts?.map((f) => f.family) ?? []), ...x.fonts]).slice(0, 3),
      logoUrl: d.visual.logoUrl,
    },
    sources: uniq([...d.sources, { url: page.url, fetchedAt: at }], (s) => s.url),
  };
}

function demoExtract(brand: Brand, page: ScrapeResult): DossierExtract {
  const d = brand.dossier;
  return {
    oneLiner: d.oneLiner || page.description || page.title || brand.name,
    positioning: d.positioning || page.description || "",
    offers: d.offers,
    personas: d.personas,
    voice: d.voice,
    proof: d.proof,
    claimsAllowed: d.claimsAllowed,
    claimsForbidden: d.claimsForbidden,
    colors: d.visual.colors,
    fonts: d.visual.fonts ?? [],
    competitors: d.competitors,
    gaps: d.gaps.filter((g) => !g.startsWith("Everything:")).length
      ? d.gaps
      : ["Pricing", "Proof and reviews", "Who can appear on camera", "Budget for paid tests", "Target markets"],
    vertical: brand.vertical,
    countries: brand.countries,
    languages: brand.languages.length ? brand.languages : page.language ? [page.language.slice(0, 2)] : ["en"],
  };
}

export async function intake(ctx: PhaseCtx): Promise<void> {
  const { db, run } = ctx;
  const brand = ctx.brand;
  await ctx.emit("tool_call", `crawl_site ${brand.url}`, {
    data: { tool: "crawl_site", provider: "firecrawl", url: brand.url },
  });
  // the crawl never kills the run: Firecrawl -> direct fetch -> empty page with a warning
  const { page, mode } = await scrape(db, brand.url, { runId: run.id, signal: ctx.signal }).catch(async (e) => {
    await ctx.emit("warning", "Firecrawl could not read the site; trying a direct fetch", {
      detail: e instanceof Error ? e.message : String(e),
    });
    const direct = await directFetch(brand.url, ctx.signal).catch(async (e2) => {
      await ctx.emit("warning", "The site could not be read at all; continuing from what we know", {
        detail: e2 instanceof Error ? e2.message : String(e2),
      });
      return { url: brand.url, markdown: "", source: "direct" as const };
    });
    return { page: direct as ScrapeResult, mode: "demo" as const };
  });
  ctx.check();
  await ctx.emit(
    "tool_result",
    `Site read (${page.source}${mode === "demo" ? ", demo" : ""}): ${page.title ?? brand.url}`,
    {
      detail: (page.description ?? page.markdown.slice(0, 240)) || undefined,
      data: { chars: page.markdown.length, branding: page.branding?.colors ?? null },
    },
  );

  const system = loadPrompt("intake", { rulePack: rulePackText(brand.rulePack) });
  const user = [
    `Brand: ${brand.name} (${brand.url})`,
    `Known so far (curated, keep consistent): ${JSON.stringify({ vertical: brand.vertical, countries: brand.countries, languages: brand.languages, oneLiner: brand.dossier.oneLiner })}`,
    `Page title: ${page.title ?? ""}`,
    `Meta description: ${page.description ?? ""}`,
    `Extracted branding: ${JSON.stringify(page.branding ?? {})}`,
    "Page content (markdown):",
    page.markdown.slice(0, 24000) || "(the page could not be read; rely on the known facts and list gaps)",
  ].join("\n");
  const x = await structured(
    { db, runId: run.id, phase: "intake" },
    {
      route: "extraction",
      system,
      user,
      schema: DossierExtract,
      note: `intake: dossier for ${brand.slug}`,
      demo: () => demoExtract(brand, page),
    },
  );
  ctx.check();
  const at = new Date().toISOString();
  const patch = mergeCrawl(brand.dossier, x.value, page, at);
  const next = await patchDossier(db, brand.id, patch, "crawl", page.url);
  if (next && (!brand.countries.length || !brand.languages.length || brand.vertical === "other")) {
    await upsertBrand(db, {
      ...next,
      vertical: brand.vertical === "other" ? x.value.vertical : brand.vertical,
      countries: brand.countries.length ? brand.countries : x.value.countries,
      languages: brand.languages.length ? brand.languages : x.value.languages,
      rulePack:
        brand.rulePack === "common" && x.value.vertical === "telehealth_rx" ? "eu_rx_telehealth" : brand.rulePack,
      updatedAt: at,
    });
  }
  const b = await ctx.refreshBrand();
  await ctx.emit("thinking", `Gaps to close: ${b.dossier.gaps.slice(0, 4).join("; ")}`, { data: { mode: x.mode } });
}
