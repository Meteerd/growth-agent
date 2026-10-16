import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import type { Brand, Vertical } from "@/contracts";
import { type BetaContentBlockParam, loadPrompt, structured } from "../agent/claude";
import { DossierExtract, mergeCrawl } from "../agent/phases/intake";
import type { Db } from "../db/client";
import { newId, nowIso, slugify } from "../ids";
import { directFetch, type ScrapeResult, scrape } from "../providers/firecrawl";
import { listBrands, patchDossier, slugExists, upsertBrand } from "../repo";
import { rulePackText } from "../rules";
import { normalizeUrl } from "../services/brands";
import { assetsDir, fileToUrl, urlToFile } from "../video/files";
import { getConfig, setConfig } from "./config";
import type { JobCtx } from "./jobs";
import { HEAD_FONTS } from "./render/type";
import { Competitor, type StudioBrandConfig } from "./types";
import { webResearch } from "./web";

/**
 * Brand setup: from a URL to a ready brand kit. Reads the site (Firecrawl, direct fetch for images), writes the
 * dossier (Claude), downloads the site's own images and picks the logo and usable photos (Claude vision),
 * screenshots the site on a phone (the product shot), and finds the competitors to watch in the brand's markets
 * (Claude with web search). Everything lands in the studio config, editable by chat or UI.
 */

const RULE_PACK: Record<Vertical, string> = {
  telehealth_rx: "eu_rx_telehealth",
  consumer_app: "common",
  health_wellness_dtc: "common",
  b2b_saas: "common",
  other: "common",
};

export function studioDir(...p: string[]) {
  return path.join(assetsDir(), "studio", ...p);
}

async function findOrCreateBrand(db: Db, url: URL, name?: string): Promise<Brand> {
  const host = url.hostname.replace(/^www\./, "");
  const existing = (await listBrands(db)).find((b) => {
    try {
      return new URL(b.url).hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  const nm = name?.trim() || host.split(".")[0]!.replace(/^./, (c) => c.toUpperCase());
  let slug = slugify(nm);
  for (let i = 2; await slugExists(db, slug); i++) slug = `${slugify(nm)}-${i}`;
  const now = nowIso();
  const brand: Brand = {
    id: newId("brand"),
    slug,
    name: nm,
    url: url.origin + (url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : ""),
    vertical: "other",
    countries: [],
    languages: [],
    rulePack: "common",
    demo: false,
    createdAt: now,
    updatedAt: now,
    dossier: {
      oneLiner: "",
      positioning: "",
      offers: [],
      personas: [],
      voice: { tone: "", do: [], dont: [] },
      proof: [],
      claimsAllowed: [],
      claimsForbidden: [],
      visual: { colors: [] },
      competitors: [],
      gaps: ["Everything: setup has not run yet"],
      sources: [],
    },
  };
  await upsertBrand(db, brand);
  return brand;
}

// ---------------------------------------------------------------- site images

function imageCandidates(html: string, base: string): { url: string; hint: string }[] {
  const out: { url: string; hint: string }[] = [];
  const add = (u: string | undefined, hint: string) => {
    if (!u || u.startsWith("data:")) return;
    try {
      const abs = new URL(u.trim().split(" ")[0]!, base).toString();
      if (!out.some((x) => x.url === abs)) out.push({ url: abs, hint });
    } catch {
      // not a URL
    }
  };
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*(apple-touch-icon|icon)[^"']*["'][^>]*>/gi))
    add(m[0].match(/href=["']([^"']+)/i)?.[1], "icon");
  for (const m of html.matchAll(/<meta[^>]+(property|name)=["'](og:image|twitter:image)["'][^>]*>/gi))
    add(m[0].match(/content=["']([^"']+)/i)?.[1], "og");
  for (const m of html.matchAll(/<img[^>]*>/gi)) {
    const tag = m[0];
    const src =
      tag.match(/\s(?:data-src|src)=["']([^"']+)/i)?.[1] ??
      tag.match(/srcset=["']([^"',\s]+)/i)?.[1];
    const alt = tag.match(/alt=["']([^"']*)/i)?.[1] ?? "";
    add(src, /logo/i.test(tag) ? `logo ${alt}` : alt);
  }
  for (const m of html.matchAll(/url\(["']?([^"')]+\.(?:jpe?g|png|webp))["']?\)/gi)) add(m[1], "css");
  return out.slice(0, 40);
}

async function downloadImages(
  url: string,
  html: string,
  dir: string,
  signal?: AbortSignal,
): Promise<{ file: string; url: string; hint: string; w: number; h: number }[]> {
  fs.mkdirSync(dir, { recursive: true });
  const cands = imageCandidates(html, url);
  const got: { file: string; url: string; hint: string; w: number; h: number }[] = [];
  await Promise.all(
    cands.map(async (c) => {
      try {
        const res = await fetch(c.url, { signal, headers: { "user-agent": "Mozilla/5.0 (rekampols studio)" } });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 12_000_000 || buf.length < 400) return;
        // everything is re-encoded (SVG rasterised): nothing from the site is served as-is
        const img = sharp(buf, { density: 300, animated: false });
        const meta = await img.metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        const isIcon = /icon|logo/i.test(c.hint);
        if (!isIcon && Math.min(w, h) < 280) return;
        const name = `site_${crypto.createHash("sha1").update(c.url).digest("hex").slice(0, 10)}.webp`;
        const file = path.join(dir, name);
        await img.resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toFile(file);
        got.push({ file, url: c.url, hint: c.hint, w, h });
      } catch {
        // skip images that fail to load or decode
      }
    }),
  );
  return got.slice(0, 24);
}

// ---------------------------------------------------------------- phone screenshot

export async function phoneShot(url: string, out: string, language?: string): Promise<string | null> {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: language,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      // dismiss a cookie banner if there is an obvious button
      const btn = page
        .getByRole("button", { name: /accept|agree|allow all|ok|got it|súhlas|souhlas|přijmout|prijať|aceptar|kabul/i })
        .first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out, type: "png" });
      return out;
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.warn("[studio] phone screenshot failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------- kit (vision)

const Kit = z.object({
  images: z.array(
    z.object({
      index: z.number(),
      role: z.enum(["logo", "logo_light", "product", "lifestyle", "person", "illustration", "screenshot", "unusable"]),
      note: z.string(),
    }),
  ),
  colors: z.object({ primary: z.string(), accent: z.string(), ink: z.string(), paper: z.string() }),
  headFont: z.string(),
  ctaUrl: z.string(),
  offer: z.string(),
  disclaimers: z.array(z.string()),
  defaultLanguage: z.string(),
});

async function pickKit(
  ctx: JobCtx,
  brand: Brand,
  imgs: { file: string; hint: string; w: number; h: number }[],
  page: { colors: string[]; markdown: string },
) {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: `Brand: ${brand.name} (${brand.url}). Site colours found: ${page.colors.join(", ") || "none"}. Dossier: ${JSON.stringify({ oneLiner: brand.dossier.oneLiner, offers: brand.dossier.offers, languages: brand.languages })}\nSite text (start):\n${page.markdown.slice(0, 5000)}`,
    },
  ];
  for (const [i, im] of imgs.entries()) {
    const thumb = await sharp(im.file).flatten({ background: "#ffffff" }).resize(320, 320, { fit: "inside" }).jpeg({ quality: 72 }).toBuffer();
    content.push({ type: "text", text: `Image ${i} (${im.w}x${im.h}, ${im.hint.slice(0, 60)})` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumb.toString("base64") } });
  }
  const r = await structured(
    { db: ctx.db },
    {
      route: "vision",
      system: `You set up the brand kit for an ad generator. For each image say what it is: logo (the brand mark on light background), logo_light (a light/white version for dark backgrounds), product (the product, app or service shown), lifestyle (real-feeling photo usable behind ad copy), person (a real team member or doctor portrait), illustration, screenshot, or unusable (tiny, cropped, generic stock icon, badge, payment logo, someone else's logo). Colours: primary = the brand's main colour, accent = the colour for highlights and CTA buttons (must stand out), ink = the dark text colour, paper = the light background colour; all hex from the site's palette. headFont: the closest headline font from this list: ${HEAD_FONTS.join(", ")} (default jakarta). ctaUrl: the site host without https. offer: the main offer stated on the site (trial, first consultation price), verbatim, or "". disclaimers: lines the site requires (for example "Not veterinary advice."), verbatim, or []. defaultLanguage: the language the site speaks to its main market (BCP-47 short, e.g. sk, en, es).`,
      user: content,
      schema: Kit,
      note: `studio setup: kit for ${brand.slug}`,
      maxTokens: 6000,
      demo: () => ({
        images: imgs.map((_, i) => ({ index: i, role: "lifestyle" as const, note: "" })),
        colors: { primary: page.colors[0] ?? "#2F6BFF", accent: page.colors[1] ?? page.colors[0] ?? "#2F6BFF", ink: "#141414", paper: "#FAF7F2" },
        headFont: "jakarta",
        ctaUrl: new URL(brand.url).host,
        offer: "",
        disclaimers: [],
        defaultLanguage: brand.languages[0] ?? "en",
      }),
    },
  );
  await ctx.cost(r.usd);
  return r.value;
}

// ---------------------------------------------------------------- competitors

const CompetitorsOut = z.object({
  competitors: z.array(Competitor),
  searchTerms: z.array(z.string()),
});

export async function findCompetitors(ctx: JobCtx, brand: Brand, cfg: StudioBrandConfig) {
  const markets = cfg.countries.join(", ") || brand.countries.join(", ") || "its main market";
  const research = await webResearch(ctx.db, {
    note: `studio: competitors for ${brand.slug}`,
    maxSearches: 8,
    system:
      "You are a performance-marketing researcher. You find the direct competitors that actually advertise on Meta (Facebook/Instagram) in a given market, and the exact Facebook page names they advertise under. Be factual; cite sources inline; say when unsure.",
    prompt: `Brand: ${brand.name} (${brand.url}). What it is: ${brand.dossier.oneLiner || "(see site)"} ${brand.dossier.positioning}\nMarkets: ${markets}. Languages: ${cfg.languages.join(", ")}.\nKnown competitors: ${cfg.competitors.map((c) => c.name).join(", ") || "none"}.\n\nFind 5 to 8 direct competitors that sell the same thing to the same people in these markets (local players first, then international ones that advertise there), with their website and the Facebook page name they advertise under (that is what we type into the Meta Ad Library). Also give 3 to 5 short category search terms in the local language(s) people would see ads for (e.g. "online lekár chudnutie", "dog training app").`,
  });
  await ctx.cost(research.usd);
  const r = await structured(
    { db: ctx.db },
    {
      route: "extraction",
      system:
        "Turn the research notes into JSON. adLibraryQuery = the Facebook page name (or the brand name if unknown). Keep only real, direct competitors. why = one short line. Keep the brand's existing competitors if they are real.",
      user: `Brand: ${brand.name}. Existing: ${JSON.stringify(cfg.competitors)}\n\nResearch notes:\n${research.text || "(no live research available; use the existing list and the dossier)"}\n\nDossier competitors: ${JSON.stringify(brand.dossier.competitors)}`,
      schema: CompetitorsOut,
      note: `studio: competitors json ${brand.slug}`,
      maxTokens: 4000,
      demo: () => ({ competitors: cfg.competitors, searchTerms: cfg.searchTerms }),
    },
  );
  await ctx.cost(r.usd);
  return r.value;
}

// ---------------------------------------------------------------- setup

export interface SetupInput {
  url: string;
  name?: string;
  countries?: string[];
  languages?: string[];
  notes?: string[];
  /** skip the web search for competitors (faster) */
  skipCompetitors?: boolean;
}

export async function setupBrand(ctx: JobCtx, input: SetupInput): Promise<{ brand: Brand; config: StudioBrandConfig }> {
  const { db } = ctx;
  const url = normalizeUrl(input.url);
  await ctx.step("Creating the brand", 0.02);
  let brand = await findOrCreateBrand(db, url, input.name);
  if (input.countries?.length || input.languages?.length) {
    brand = {
      ...brand,
      countries: input.countries?.length ? input.countries : brand.countries,
      languages: input.languages?.length ? input.languages : brand.languages,
    };
    await upsertBrand(db, brand);
  }
  const dir = studioDir("brands", brand.slug);
  fs.mkdirSync(dir, { recursive: true });

  await ctx.step(`Reading ${url.host}`, 0.08);
  const [{ page, mode }, html] = await Promise.all([
    scrape(db, brand.url, { signal: ctx.signal }).catch(async () => ({
      page: await directFetch(brand.url, ctx.signal).catch((): ScrapeResult => ({ url: brand.url, markdown: "", source: "direct" })),
      mode: "demo" as const,
    })),
    fetch(brand.url, { signal: ctx.signal, headers: { "user-agent": "Mozilla/5.0 (rekampols studio)" } })
      .then((r) => r.text())
      .catch(() => ""),
  ]);
  await ctx.log(`Site read (${page.source}${mode === "demo" ? ", fallback" : ""}): ${page.title ?? brand.url}`);

  await ctx.step("Writing the dossier", 0.18);
  const x = await structured(
    { db },
    {
      route: "extraction",
      system: loadPrompt("intake", { rulePack: rulePackText(brand.rulePack) }),
      user: [
        `Brand: ${brand.name} (${brand.url})`,
        `Known so far: ${JSON.stringify({ countries: brand.countries, languages: brand.languages })}`,
        `Operator notes: ${(input.notes ?? []).join(" | ") || "none"}`,
        `Page title: ${page.title ?? ""}`,
        `Meta description: ${page.description ?? ""}`,
        `Extracted branding: ${JSON.stringify(page.branding ?? {})}`,
        "Page content (markdown):",
        page.markdown.slice(0, 24000) || "(the page could not be read; rely on what is known and list gaps)",
      ].join("\n"),
      schema: DossierExtract,
      note: `studio setup: dossier ${brand.slug}`,
      demo: () => ({
        oneLiner: page.description ?? brand.name,
        positioning: page.description ?? "",
        offers: [],
        personas: [],
        voice: { tone: "", do: [], dont: [] },
        proof: [],
        claimsAllowed: [],
        claimsForbidden: [],
        colors: [],
        fonts: [],
        competitors: [],
        gaps: ["The site could not be analysed in demo mode"],
        vertical: brand.vertical,
        countries: brand.countries,
        languages: brand.languages.length ? brand.languages : ["en"],
      }),
    },
  );
  await ctx.cost(x.usd);
  const at = nowIso();
  await patchDossier(db, brand.id, mergeCrawl(brand.dossier, x.value, page, at), "crawl", page.url);
  const vertical = brand.vertical === "other" ? x.value.vertical : brand.vertical;
  brand = {
    ...(await (await import("../repo")).getBrand(db, brand.id))!,
    vertical,
    countries: brand.countries.length ? brand.countries : x.value.countries,
    languages: brand.languages.length ? brand.languages : x.value.languages,
    rulePack: brand.rulePack === "common" ? RULE_PACK[vertical] : brand.rulePack,
    updatedAt: at,
  };
  await upsertBrand(db, brand);

  await ctx.step("Collecting the brand's own images", 0.3);
  const imgs = await downloadImages(brand.url, html, path.join(dir, "site"), ctx.signal);
  await ctx.log(`${imgs.length} usable images found on the site`);

  await ctx.step("Screenshotting the site on a phone", 0.38);
  const shot = await phoneShot(brand.url, path.join(dir, "product_phone.png"), brand.languages[0]);

  await ctx.step("Picking the logo, photos, colours and type", 0.45);
  const siteColors = [
    ...Object.values(page.branding?.colors ?? {}).filter((c): c is string => typeof c === "string" && c.startsWith("#")),
    ...x.value.colors,
  ];
  const kit = await pickKit(ctx, brand, imgs, { colors: siteColors, markdown: page.markdown });
  const byIdx = (i: number) => imgs[i];
  const logo = kit.images.find((k) => k.role === "logo" && byIdx(k.index));
  const logoLight = kit.images.find((k) => k.role === "logo_light" && byIdx(k.index));
  const usable = kit.images.filter((k) => ["product", "lifestyle", "person", "illustration"].includes(k.role) && byIdx(k.index));

  let cfg = await getConfig(db, brand);
  const prevImages = cfg.brandImages.filter((b) => !urlToFile(b.url)?.includes(`${path.sep}site${path.sep}`));
  cfg = await setConfig(db, brand, {
    countries: brand.countries.length ? brand.countries : cfg.countries,
    languages: brand.languages.length ? brand.languages : cfg.languages,
    defaultLanguage: brand.languages.includes(kit.defaultLanguage) ? kit.defaultLanguage : (brand.languages[0] ?? kit.defaultLanguage),
    logo: logo ? fileToUrl(byIdx(logo.index)!.file) : cfg.logo,
    logoOnDark: logoLight ? fileToUrl(byIdx(logoLight.index)!.file) : cfg.logoOnDark,
    brandImages: [
      ...prevImages,
      ...usable.map((k) => ({ url: fileToUrl(byIdx(k.index)!.file), note: `${k.role}: ${k.note}` })),
    ].slice(0, 30),
    productShot: shot ? fileToUrl(shot) : cfg.productShot,
    colors: Object.values(kit.colors).every((c) => /^#[0-9a-f]{6}$/i.test(c)) ? kit.colors : cfg.colors,
    fonts: { head: HEAD_FONTS.includes(kit.headFont as never) ? kit.headFont : cfg.fonts.head, body: cfg.fonts.body },
    ctaUrl: kit.ctaUrl || cfg.ctaUrl,
    offer: kit.offer || cfg.offer,
    disclaimers: cfg.disclaimers.length ? cfg.disclaimers : kit.disclaimers,
    notes: [...cfg.notes, ...(input.notes ?? [])],
  });

  if (!input.skipCompetitors) {
    await ctx.step("Finding the competitors that advertise in your markets", 0.6);
    const comp = await findCompetitors(ctx, brand, cfg);
    cfg = await setConfig(db, brand, {
      competitors: comp.competitors.length ? comp.competitors : cfg.competitors,
      searchTerms: comp.searchTerms.length ? comp.searchTerms : cfg.searchTerms,
    });
    await ctx.log(`Competitors: ${cfg.competitors.map((c) => c.name).join(", ")}`);
  }
  await ctx.step("Brand kit ready", 1);
  return { brand, config: cfg };
}
