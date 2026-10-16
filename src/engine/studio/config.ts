import fs from "node:fs";
import path from "node:path";
import type { Brand } from "@/contracts";
import type { Db } from "../db/client";
import { getBrand, listBrands } from "../repo";
import { brandAssetsDir } from "../video/files";
import { kvGet, kvSet } from "./store";
import { type StudioBrandConfig, StudioBrandConfig as StudioBrandConfigSchema } from "./types";

const IMG = /\.(png|jpe?g|webp)$/i;

/** Real images committed for the seeded brands (assets/brands/<slug>), as asset URLs. */
function committedImages(slug: string): { logo?: string; images: string[] } {
  const dir = path.join(brandAssetsDir(), slug);
  if (!fs.existsSync(dir)) return { images: [] };
  const files = fs.readdirSync(dir).filter((f) => IMG.test(f) || f.endsWith(".svg"));
  const logo = files.find((f) => /logo|mark/i.test(f) && !/white|light/i.test(f));
  return {
    logo: logo ? `/api/assets/brands/${slug}/${logo}` : undefined,
    images: files
      .filter((f) => IMG.test(f) && !/logo|mark|og-image/i.test(f))
      .map((f) => `/api/assets/brands/${slug}/${f}`),
  };
}

const lum = (hex: string) => {
  const m = hex.replace("#", "").padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(m.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

export function defaultConfig(brand: Brand): StudioBrandConfig {
  const colors = brand.dossier.visual.colors.filter((c) => /^#?[0-9a-f]{3,8}$/i.test(c));
  const dark = colors.find((c) => lum(c) < 0.25) ?? "#141414";
  const light = colors.find((c) => lum(c) > 0.85) ?? "#FAF7F2";
  const accent = colors.find((c) => c !== dark && c !== light) ?? colors[0] ?? "#2F6BFF";
  const imgs = committedImages(brand.slug);
  const lang = brand.languages[0] ?? "en";
  return {
    countries: brand.countries.length ? brand.countries : ["US"],
    languages: brand.languages.length ? brand.languages : ["en"],
    defaultLanguage: lang,
    competitors: brand.dossier.competitors.map((c) => ({ name: c.name, website: c.url, adLibraryQuery: c.name })),
    searchTerms: [],
    placement: "paid",
    // GPT Image 2.5 Flare on fal: as photoreal as GPT Image 2 direct in the 17 Oct bake-off, ~4x cheaper
    imageModel: "fal:gpt-image-2.5-flare",
    aspects: ["4:5"],
    logo: brand.dossier.visual.logoUrl ?? imgs.logo,
    brandImages: imgs.images.map((url) => ({ url })),
    colors: { primary: accent, accent, ink: dark, paper: light },
    fonts: { head: "jakarta", body: "inter" },
    notes: [],
    testimonials: [],
    disclaimers: [],
    ctaUrl: new URL(brand.url).host.replace(/^www\./, ""),
  };
}

export async function getConfig(db: Db, brand: Brand): Promise<StudioBrandConfig> {
  const saved = await kvGet<Partial<StudioBrandConfig>>(db, `brand:${brand.id}`);
  const base = defaultConfig(brand);
  const merged = { ...base, ...(saved ?? {}) };
  const parsed = StudioBrandConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export async function setConfig(db: Db, brand: Brand, patch: Partial<StudioBrandConfig>): Promise<StudioBrandConfig> {
  const cur = await getConfig(db, brand);
  const next = StudioBrandConfigSchema.parse({ ...cur, ...patch });
  await kvSet(db, `brand:${brand.id}`, next);
  return next;
}

/** Brand by id or slug, or a clear error. */
export async function mustBrand(db: Db, idOrSlug: string): Promise<Brand> {
  const b = await getBrand(db, idOrSlug);
  if (b) return b;
  const all = await listBrands(db);
  const byName = all.find((x) => x.name.toLowerCase() === idOrSlug.toLowerCase());
  if (byName) return byName;
  throw new Error(`No brand "${idOrSlug}". Known: ${all.map((x) => x.slug).join(", ")}`);
}

// ---------------------------------------------------------------- global settings

export interface StudioSettings {
  /** legacy: kept for old saved settings */
  reviewThreshold: number;
  maxAdsPerBatch: number;
  /** an ad under this score gets revised from the creative director's critique */
  targetScore: number;
  /** how many revision rounds an ad may get on the way to the target */
  maxRevisions: number;
  /** ads under this score are marked below bar instead of ready */
  qualityBar: number;
}
export const DEFAULT_SETTINGS: StudioSettings = {
  reviewThreshold: 72,
  maxAdsPerBatch: 12,
  targetScore: 80,
  maxRevisions: 1,
  qualityBar: 75,
};

export async function getSettings(db: Db): Promise<StudioSettings> {
  return { ...DEFAULT_SETTINGS, ...((await kvGet<Partial<StudioSettings>>(db, "settings")) ?? {}) };
}
export async function setSettings(db: Db, patch: Partial<StudioSettings>): Promise<StudioSettings> {
  const next = { ...(await getSettings(db)), ...patch };
  await kvSet(db, "settings", next);
  return next;
}

const gs = globalThis as unknown as { __studioSeeded?: Promise<void> };
/** The studio starts with the operator's known brands (dossiers from the seed), nothing else. */
export function ensureStudioSeeded(db: Db): Promise<void> {
  gs.__studioSeeded ??= (async () => {
    const { SEED_BRANDS } = await import("@/contracts");
    const { insertBrandIfMissing } = await import("../repo");
    for (const b of SEED_BRANDS) await insertBrandIfMissing(db, b);
  })();
  return gs.__studioSeeded;
}
