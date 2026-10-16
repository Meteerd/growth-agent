import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Brand } from "@/contracts";
import { runActor } from "../providers/apify";
import { callProvider } from "../providers/call";
import { PRICES } from "../providers/prices";
import { fileToUrl } from "../video/files";
import { getConfig, setConfig } from "./config";
import type { JobCtx } from "./jobs";
import { studioDir } from "./setup";
import { upsertRef } from "./store";
import type { AdRefBody } from "./types";

/**
 * Competitor scan: pulls the static and carousel ads each competitor is running in the brand's markets from the
 * Meta Ad Library (Apify actor), plus category keyword searches. Without spend data, the winner signal is how long
 * an ad has run and how many ads reuse the same creative (Meta's collation count: creatives that get scaled appear
 * many times). Images are kept on our disk for analysis and the reference grid only; they are never reused.
 */

const ACTOR = "curious_coder/facebook-ads-library-scraper";
type J = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function libraryUrl(o: { country: string; q?: string; pageId?: string; active?: boolean }) {
  const p = new URLSearchParams({
    active_status: o.active === false ? "all" : "active",
    ad_type: "all",
    country: o.country,
    media_type: "all",
  });
  if (o.pageId) {
    p.set("view_all_page_id", o.pageId);
    p.set("search_type", "page");
  } else {
    p.set("q", o.q ?? "");
    p.set("search_type", "keyword_unordered");
  }
  return `https://www.facebook.com/ads/library/?${p}`;
}

/** Winner score 0..100 from longevity, scaling (variants) and being live. */
export function winnerScore(days: number | undefined, variants: number | undefined, active: boolean): number {
  const d = Math.min(days ?? 0, 180) / 180;
  const v = Math.min(Math.log2(1 + (variants ?? 1)) / Math.log2(1 + 30), 1);
  return Math.round(d * 55 + v * 35 + (active ? 10 : 0));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "");

async function saveImage(url: string, file: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sharp(buf).resize(1080, 1350, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(file);
    return file;
  } catch {
    return null;
  }
}

interface SourceSpec {
  label: string;
  url: string;
  country: string;
  query: string;
  competitor?: string;
  match?: string;
}

export interface ScanInput {
  perSource?: number;
  countries?: string[];
  /** only these competitors (names) */
  only?: string[];
  includeKeywords?: boolean;
}

export async function scanCompetitors(ctx: JobCtx, brand: Brand, input: ScanInput = {}) {
  const { db } = ctx;
  let cfg = await getConfig(db, brand);
  const countries = (input.countries?.length ? input.countries : cfg.countries).slice(0, 2);
  const per = Math.min(input.perSource ?? 40, 80);
  const comps = cfg.competitors.filter((c) => !input.only?.length || input.only.some((o) => norm(o) === norm(c.name)));
  const sources: SourceSpec[] = [];
  for (const c of comps)
    for (const country of countries.slice(0, c.pageId ? 2 : 1))
      sources.push({
        label: `${c.name} (${country})`,
        url: libraryUrl({ country, q: c.adLibraryQuery, pageId: c.pageId }),
        country,
        query: c.adLibraryQuery,
        competitor: c.name,
        match: c.pageId ? undefined : c.adLibraryQuery,
      });
  if (input.includeKeywords !== false)
    for (const t of cfg.searchTerms.slice(0, 3))
      sources.push({ label: `"${t}" (${countries[0]})`, url: libraryUrl({ country: countries[0] ?? "US", q: t }), country: countries[0] ?? "US", query: t });
  if (!sources.length) throw new Error("No competitors or search terms configured for this brand. Add some first.");

  await ctx.step(`Searching the Meta Ad Library: ${sources.length} searches`, 0.05);
  const out = await callProvider(db, {
    provider: "apify",
    note: `studio scan ${brand.slug}: ${sources.length} sources`,
    estimateUsd: sources.length * per * PRICES.apify.perAdsItem + 0.05,
    demo: () => [] as J[],
    live: async () => {
      const items = await runActor(
        ACTOR,
        { urls: sources.map((s) => ({ url: s.url })), count: per * sources.length, limitPerSource: per },
        per * sources.length,
        ctx.signal,
      );
      return { result: items, usd: items.length * PRICES.apify.perAdsItem + 0.01, units: `${items.length} ads` };
    },
  });
  await ctx.cost(out.usd);
  if (out.mode === "demo") throw new Error("Apify is not live on this server (add it to LIVE_PROVIDERS).");
  const items = out.value;
  await ctx.log(`${items.length} ads returned`);

  // group by creative (collation id), keep the strongest instance
  const seen = new Map<string, J>();
  for (const it of items) {
    const key = str(it.collation_id) ?? str(it.ad_archive_id) ?? Math.random().toString();
    const prev = seen.get(key);
    if (!prev || (num(it.collation_count) ?? 0) > (num(prev.collation_count) ?? 0)) seen.set(key, it);
  }
  const pageIds = new Map<string, string>();
  const dir = studioDir("refs", brand.slug);
  let saved = 0;
  const list = [...seen.values()];
  await ctx.step(`Saving ${list.length} unique creatives`, 0.4);
  for (const [i, it] of list.entries()) {
    ctx.check();
    const snap = (it.snapshot ?? {}) as J;
    const fmt = str(snap.display_format) ?? "IMAGE";
    const videos = (snap.videos as J[] | undefined) ?? [];
    const cover = str(videos[0]?.video_preview_image_url) ?? str(((snap.cards as J[] | undefined) ?? [])[0]?.video_preview_image_url);
    const isVideo = fmt === "VIDEO" || videos.length > 0;
    if (isVideo && !cover) continue;
    const src = sources.find((s) => s.url === str(it.url)) ?? sources.find((s) => str(it.url)?.includes(encodeURIComponent(s.query)));
    const pageName = str(it.page_name) ?? str(snap.page_name) ?? "Advertiser";
    // keyword search for a competitor name returns other advertisers too: keep only that page
    if (src?.match && !norm(pageName).includes(norm(src.match).slice(0, 8)) && !norm(src.match).includes(norm(pageName).slice(0, 8)))
      continue;
    if (src?.competitor && str(it.page_id)) pageIds.set(src.competitor, str(it.page_id)!);
    const id = str(it.ad_archive_id) ?? `${i}`;
    const cardsRaw = ((snap.cards as J[] | undefined) ?? []).slice(0, 10);
    const imgsRaw = ((snap.images as J[] | undefined) ?? []).slice(0, 1);
    // DCO cards are alternative versions of one ad, not a carousel
    const isCarousel = !isVideo && fmt !== "DCO" && cardsRaw.filter((c) => str(c.original_image_url) ?? str(c.resized_image_url)).length > 1;
    const images: string[] = [];
    const cards: AdRefBody["cards"] = [];
    if (isCarousel) {
      for (const [ci, c] of cardsRaw.entries()) {
        const u = str(c.original_image_url) ?? str(c.resized_image_url);
        const f = u ? await saveImage(u, path.join(dir, `${id}_${ci}.jpg`), ctx.signal) : null;
        cards.push({ title: str(c.title), body: str(c.body), image: f ? fileToUrl(f) : undefined });
        if (f) images.push(fileToUrl(f));
      }
    } else if (isVideo) {
      const f = await saveImage(cover!, path.join(dir, `${id}_cover.jpg`), ctx.signal);
      if (f) images.push(fileToUrl(f));
    } else {
      const u =
        str(imgsRaw[0]?.original_image_url) ??
        str(imgsRaw[0]?.resized_image_url) ??
        str(cardsRaw[0]?.original_image_url) ??
        str(cardsRaw[0]?.resized_image_url);
      const f = u ? await saveImage(u, path.join(dir, `${id}.jpg`), ctx.signal) : null;
      if (f) images.push(fileToUrl(f));
    }
    if (!images.length) continue;
    const start = num(it.start_date);
    const active = it.is_active === true;
    const end = active ? Date.now() / 1000 : (num(it.end_date) ?? Date.now() / 1000);
    const days = start ? Math.max(0, Math.round((end - start) / 86400)) : undefined;
    const variants = num(it.collation_count);
    const body: AdRefBody = {
      adLibraryUrl: str(it.ad_library_url) ?? `https://www.facebook.com/ads/library/?id=${id}`,
      pageName,
      pageId: str(it.page_id),
      competitor: src?.competitor,
      country: src?.country ?? countries[0] ?? "",
      query: src?.query ?? "",
      startDate: str(it.start_date_formatted),
      endDate: active ? undefined : str(it.end_date_formatted),
      active,
      daysRunning: days,
      variants,
      platforms: ((it.publisher_platform as string[] | undefined) ?? []).map(String),
      displayFormat: fmt,
      title: str(snap.title),
      body: str((snap.body as J | undefined)?.text)?.slice(0, 1500),
      linkUrl: str(snap.link_url),
      cta: str(snap.cta_text),
      images,
      cards,
    };
    await upsertRef(db, {
      brandId: brand.id,
      source: "meta_ad_library",
      externalId: id,
      advertiser: pageName,
      mediaType: isCarousel ? "carousel" : isVideo ? "video_cover" : "image",
      // a video's cover frame is a weaker reference for statics than a real static
      score: Math.round(winnerScore(days, variants, active) * (isVideo ? 0.85 : 1)),
      body,
    });
    saved++;
    if (i % 10 === 0) await ctx.step(`Saved ${saved} creatives`, 0.4 + (0.55 * i) / list.length);
  }
  // remember page ids so the next scan is an exact advertiser match
  if (pageIds.size) {
    cfg = await setConfig(db, brand, {
      competitors: cfg.competitors.map((c) => (pageIds.has(c.name) && !c.pageId ? { ...c, pageId: pageIds.get(c.name) } : c)),
    });
  }
  return { searched: sources.length, returned: items.length, saved };
}
