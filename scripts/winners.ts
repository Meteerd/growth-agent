/**
 * npx tsx --tsconfig tsconfig.json scripts/winners.ts <slug> [--no-apify] [--no-spiral] [--no-youtube]
 * Finds on-category winning ads/posts for one brand with real provider numbers (Spiral brand winners,
 * YouTube Shorts, one small Apify TikTok search). Every call goes through callProvider (caps + ledger).
 * Writes data/winners/<slug>.raw.json (all candidates + provider status). Curation into
 * data/winners/<slug>.json is done by the operator/agent from the raw file; nothing here touches concepts.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "spiral,apify,youtube";
const args = process.argv.slice(2);
const slug = args[0];
if (!slug) throw new Error("usage: winners.ts <slug>");
const skip = (p: string) => args.includes(`--no-${p}`);

const { getDb } = await import("@/engine/db/client");
const { callProvider } = await import("@/engine/providers/call");
const { fetchRetry, okJson } = await import("@/engine/providers/http");
const { youtubeShorts } = await import("@/engine/providers/youtube");
const { tiktokSearch } = await import("@/engine/providers/apify");
const repo = await import("@/engine/repo");
const db = await getDb();
const brand = await repo.getBrand(db, slug);
if (!brand) throw new Error(`no brand ${slug}`);

type J = Record<string, unknown>;
interface Cfg {
  competitors: string[];
  spiralQuery: string;
  shorts: { q: string[]; lang?: string }[];
  tiktok: { hashtags: string[]; queries: string[] };
}
const CFG: Record<string, Cfg> = {
  hound: {
    competitors: ["Dogo", "Woofz", "Pupford", "Zigzag", "GoodPup"],
    spiralQuery: "dog training app for puppy and separation anxiety, owner training the dog at home",
    shorts: [
      { q: ["dog separation anxiety training", "puppy training tips", "stop dog barking when left alone"], lang: "en" },
    ],
    tiktok: { hashtags: ["dogseparationanxiety"], queries: ["dog separation anxiety training"] },
  },
  aclinic: {
    competitors: ["Hims & Hers", "Voy", "Numan", "Juniper", "Ro", "Found"],
    spiralQuery: "doctor-led GLP-1 weight loss telehealth program, online prescription and weight care",
    shorts: [
      { q: ["GLP-1 weight loss doctor explains", "semaglutide weight loss doctor"], lang: "en" },
      { q: ["chudnutie lekár", "hubnutí lékař ozempic"], lang: "cs" },
    ],
    tiktok: { hashtags: ["chudnutie", "hubnuti"], queries: ["ozempic lekár"] },
  },
  dynova: {
    competitors: ["23andMe", "Viome", "Nebula Genomics", "Ritual", "Care/of", "AG1"],
    spiralQuery: "at-home DNA test kit with personalized nutrition and supplement recommendations",
    shorts: [
      { q: ["DNA test results nutrition", "gut microbiome test results", "personalized vitamins quiz"], lang: "en" },
      { q: ["DNA testi sonuçları", "genetik test beslenme"], lang: "tr" },
    ],
    tiktok: { hashtags: ["dnatesti", "genetiktest"], queries: ["dna testi sonuçlarım"] },
  },
};
const cfg = CFG[slug];
if (!cfg) throw new Error(`no winners config for ${slug}`);

const status: string[] = [];
const log = (s: string) => {
  status.push(s);
  console.log(s);
};
let credits: string | undefined;

/** One Spiral GET through the ledger (credits, not USD; estimate 0 like the engine's spiral provider). */
async function spiral<T>(p: string, note: string): Promise<T | null> {
  try {
    const out = await callProvider<T | null>(db, {
      provider: "spiral",
      note: `winners: ${note}`,
      estimateUsd: 0,
      demo: () => null,
      live: async () => {
        const res = await fetchRetry(`https://public-api.spiral.ad/v1${p}`, {
          headers: { Authorization: `Bearer ${process.env.SPIRAL_API_KEY}` },
          timeoutMs: 90_000,
        });
        const charged = res.headers.get("x-credits-charged");
        credits = res.headers.get("x-credits-remaining") ?? credits;
        const j = await okJson<T>(res, `spiral ${p.split("?")[0]}`);
        return { result: j, usd: 0, units: charged ? `${charged} credits` : undefined };
      },
    });
    if (out.mode !== "live") log(`spiral NOT LIVE for ${note} (demo fallback, no data)`);
    return out.value;
  } catch (e) {
    log(`spiral FAILED ${note}: ${(e as Error).message.slice(0, 200)}`);
    return null;
  }
}

const candidates: J[] = [];
const daysBetween = (a?: unknown, b?: unknown) => {
  const s = typeof a === "string" ? Date.parse(a) : Number.NaN;
  const e = typeof b === "string" ? Date.parse(b) : Date.now();
  return Number.isFinite(s) ? Math.round((e - s) / 86400000) : undefined;
};

// ---------------------------------------------------------------- Spiral: competitor brand winners
if (!skip("spiral")) {
  for (const name of cfg.competitors) {
    const found = await spiral<{ data: J[] }>(
      `/brands/search?name=${encodeURIComponent(name)}&limit=5`,
      `brand search ${name}`,
    );
    const list = found?.data ?? [];
    log(`spiral brand search "${name}": ${list.map((b) => `${b.name} (${b.category ?? "?"})`).join("; ") || "none"}`);
    const norm = (s: unknown) =>
      String(s ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const b = list.find((x) => norm(x.name) === norm(name)) ?? list.find((x) => norm(x.name).startsWith(norm(name)));
    if (!b) {
      log(`spiral: no exact brand match for "${name}", skipped (not guessing)`);
      continue;
    }
    const w = await spiral<{ items: J[] }>(`/brands/${b.uuid}/winners?sort=winning_score&limit=5`, `winners ${b.name}`);
    for (const it of w?.items ?? []) {
      const ad = (it.ad ?? {}) as J;
      const page = (ad.meta_page ?? {}) as J;
      const creatives = (ad.creatives ?? []) as J[];
      const archive = ad.ad_archive_id ?? ad.meta_ad_id ?? ad.library_id;
      candidates.push({
        source: "spiral",
        platform: "meta_ad",
        advertiser: b.name,
        page: page.name,
        uuid: ad.uuid,
        // Spiral exposes no Meta library id: link = Spiral-hosted creative + an Ad Library search for the advertiser
        url: ad.original_media_url ?? (archive ? `https://www.facebook.com/ads/library/?id=${archive}` : undefined),
        adLibrarySearch: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(name)}`,
        mediaTypes: ad.creative_media_types,
        hook: String(ad.body ?? ad.title ?? "").slice(0, 300),
        creativeType: ad.creative_type,
        format:
          String(ad.creative_type ?? "").toUpperCase() === "CAROUSEL" || creatives.length > 1
            ? "carousel"
            : String(ad.creative_type ?? "").toUpperCase() === "VIDEO"
              ? "video"
              : "static",
        metrics: {
          winning_score: it.winning_score,
          classification: it.classification,
          active_days: it.active_days,
          duplicate_count: it.duplicate_count,
          start_date: ad.start_date,
          end_date: ad.end_date,
          is_active: ad.is_active,
          eu_total_reach: ad.eu_total_reach,
          days_from_dates: daysBetween(ad.start_date, ad.is_active ? undefined : ad.end_date),
          language_code: ad.language_code,
        },
        explanation: it.explanation,
        adKeys: Object.keys(ad),
      });
    }
    log(`spiral winners ${b.name}: ${w?.items?.length ?? 0} items`);
  }
}

// details (hook, transcript, landing) for the strongest passing Spiral ads only (billed per ad)
{
  const top = candidates
    .filter((c) => c.source === "spiral")
    .filter((c) => Number((c.metrics as J).active_days) >= 45 || Number((c.metrics as J).duplicate_count) >= 3)
    .sort((a, b) => Number((b.metrics as J).winning_score) - Number((a.metrics as J).winning_score))
    .slice(0, 8);
  if (top.length) {
    const d = await spiral<{ data: J[] }>(
      `/ads/meta?uuids=${top.map((c) => c.uuid).join(",")}`,
      `details ${top.length} ads`,
    );
    for (const ad of d?.data ?? []) {
      const c = top.find((x) => x.uuid === ad.uuid);
      if (!c) continue;
      const a = (ad.creative_analysis ?? {}) as J;
      const hook = (a.hook ?? {}) as J;
      c.landing = ad.link_url;
      c.ctaText = ad.cta_text;
      c.campaignType = ad.campaign_type;
      c.creativeCount = ((ad.creatives ?? []) as J[]).length;
      c.spokenHook = hook.exact_text_or_description;
      c.hookMechanism = hook.mechanism_label;
      c.angle = ((a.persuasion_mechanism ?? {}) as J).primary_lever;
      c.structure = ((a.structural_summary ?? {}) as J).narrative_structure;
      c.transcript = String(((ad.audio_transcript ?? {}) as J).full_text ?? "").slice(0, 400) || undefined;
    }
  }
}

// ---------------------------------------------------------------- Spiral ads search (category query, 45+ run days)
if (args.includes("--search")) {
  const qs = new URLSearchParams({
    query: cfg.spiralQuery,
    app_type: "app",
    limit: "10",
    creative_type: "all",
    min_run_days: "45",
  });
  const found = await spiral<{ data: J[] }>(`/ads/meta/search?${qs}`, `ads search ${cfg.spiralQuery}`);
  const uuids = (found?.data ?? []).map((d) => d.uuid as string).filter(Boolean);
  const extra = (args.find((a) => a.startsWith("--details="))?.slice(10) ?? "").split(",").filter(Boolean);
  const all = [...new Set([...uuids, ...extra])].slice(0, 20);
  log(`spiral ads search: ${uuids.length} ads (+${extra.length} requested details)`);
  if (all.length) {
    const d = await spiral<{ data: J[] }>(`/ads/meta?uuids=${all.join(",")}`, `search details ${all.length} ads`);
    for (const ad of d?.data ?? []) {
      const a = (ad.creative_analysis ?? {}) as J;
      const hook = (a.hook ?? {}) as J;
      const page = (ad.meta_page ?? {}) as J;
      const pb = (page.brand ?? {}) as J;
      const days = daysBetween(ad.start_date, ad.is_active ? undefined : ad.end_date);
      candidates.push({
        source: "spiral_search",
        platform: "meta_ad",
        advertiser: pb.name ?? page.name,
        uuid: ad.uuid,
        url: ad.original_media_url,
        landing: ad.link_url,
        hook: String(ad.body ?? "").slice(0, 300),
        spokenHook: hook.exact_text_or_description,
        angle: ((a.persuasion_mechanism ?? {}) as J).primary_lever,
        transcript: String(((ad.audio_transcript ?? {}) as J).full_text ?? "").slice(0, 400) || undefined,
        creativeType: ad.creative_type,
        creativeCount: ((ad.creatives ?? []) as J[]).length,
        format:
          ((ad.creatives ?? []) as J[]).length > 1
            ? "carousel"
            : String(ad.creative_type ?? "").toUpperCase() === "VIDEO"
              ? "video"
              : "static",
        metrics: {
          start_date: ad.start_date,
          end_date: ad.end_date,
          is_active: ad.is_active,
          days_from_dates: days,
          active_days: days,
          eu_total_reach: ad.eu_total_reach,
          language_code: ad.language_code,
          requested: extra.includes(ad.uuid as string),
        },
      });
    }
  }
}

// ---------------------------------------------------------------- YouTube Shorts (free, quota only)
const ctx = { db, runId: "", brand, demoEvidence: [], limit: 12 };
if (!skip("youtube")) {
  for (const s of cfg.shorts) {
    try {
      const r = await youtubeShorts(ctx, s.q, s.lang);
      log(`youtube ${s.q.join(" | ")}: mode=${r.mode}, ${r.items.length} items`);
      for (const e of r.items)
        candidates.push({
          source: "youtube",
          platform: "youtube_shorts",
          advertiser: e.author,
          url: e.url,
          hook: e.title,
          format: "video",
          metrics: {
            ...e.metrics,
            viewsPerFollower:
              e.metrics.views && e.metrics.followers ? +(e.metrics.views / e.metrics.followers).toFixed(1) : undefined,
          },
          text: e.text?.slice(0, 200),
          demo: r.mode !== "live",
        });
    } catch (e) {
      log(`youtube FAILED ${s.q.join(" | ")}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------- Apify TikTok (one small search)
if (!skip("apify")) {
  try {
    const r = await tiktokSearch({ ...ctx, limit: 12 }, cfg.tiktok.hashtags, cfg.tiktok.queries);
    log(
      `apify tiktok ${[...cfg.tiktok.hashtags, ...cfg.tiktok.queries].join(", ")}: mode=${r.mode}, ${r.items.length} items, $${r.usd.toFixed(3)}`,
    );
    for (const e of r.items)
      candidates.push({
        source: "apify",
        platform: "tiktok",
        advertiser: e.author,
        url: e.url,
        hook: e.title,
        format: "video",
        metrics: {
          ...e.metrics,
          viewsPerFollower:
            e.metrics.views && e.metrics.followers ? +(e.metrics.views / e.metrics.followers).toFixed(1) : undefined,
        },
        tags: e.tags,
        demo: r.mode !== "live",
      });
  } catch (e) {
    log(`apify FAILED: ${(e as Error).message.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------- bar check (mechanical; category is reviewed by hand)
for (const c of candidates) {
  const m = c.metrics as J;
  const rules: string[] = [];
  if (c.platform === "meta_ad") {
    if (Number(m.active_days) >= 45) rules.push("paid 45+ days (active_days)");
    if (Number(m.duplicate_count) >= 3) rules.push("paid 3+ variants (duplicate_count)");
  } else if (!c.demo) {
    if (Number(m.views) >= 50000 && Number(m.viewsPerFollower) >= 5) rules.push("organic 5x+ followers and 50k+ views");
  }
  c.passes = rules;
}
const out = path.join(process.cwd(), "data/winners", `${slug}.raw.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
let prev: J = {};
try {
  prev = JSON.parse(fs.readFileSync(out, "utf8"));
} catch {}
// merge with a previous run so skipped providers keep their earlier candidates
const keep = ((prev.candidates as J[] | undefined) ?? []).filter(
  (c) => !candidates.some((n) => n.source === c.source) && !(c.demo as boolean),
);
fs.writeFileSync(
  out,
  `${JSON.stringify({ slug, at: new Date().toISOString(), spiralCreditsRemaining: credits, status: [...((prev.status as string[]) ?? []), ...status], candidates: [...keep, ...candidates] }, null, 2)}\n`,
);
const passing = [...keep, ...candidates].filter((c) => (c.passes as string[]).length);
console.log(
  `\n${passing.length} candidates pass a bar rule (of ${keep.length + candidates.length}); spiral credits remaining: ${credits ?? "?"}`,
);
for (const c of passing)
  console.log(
    `- [${c.platform}] ${c.advertiser} | ${String(c.hook).slice(0, 80)} | ${JSON.stringify(c.metrics).slice(0, 220)} | ${c.url ?? c.uuid}`,
  );
process.exit(0);
