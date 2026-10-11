import { z } from "zod";
import type { Evidence, EvidenceSource } from "@/contracts";
import { instagramSearch, metaAdsSearch, redditSearch, tiktokSearch } from "../../providers/apify";
import { isLive } from "../../providers/env";
import { finishLandscape, startLandscape } from "../../providers/manus";
import { spiralWinners } from "../../providers/spiral";
import { youtubeShorts } from "../../providers/youtube";
import { updateRun, upsertEvidence } from "../../repo";
import { scoreOutliers, tagLongevity, winnerRank } from "../../research/metrics";
import { baseEvidence, type SourceCtx, type SourceResult } from "../../research/types";
import { rulePackText } from "../../rules";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";

export const ResearchPlan = z.object({
  tiktokHashtags: z.array(z.string()),
  tiktokQueries: z.array(z.string()),
  instagramHashtags: z.array(z.string()),
  youtubeQueries: z.array(z.string()),
  redditQueries: z.array(z.string()),
  subreddits: z.array(z.string()),
  adQueries: z.array(z.string()),
  adCountry: z.string(),
  spiralQuery: z.string(),
  rationale: z.string(),
});
export type ResearchPlan = z.infer<typeof ResearchPlan>;

export const Relevance = z.object({ keep: z.array(z.string()) });

/** Drop off-topic live items before they enter the evidence base (one cheap Claude call per source). */
async function relevant(ctx: PhaseCtx, r: SourceResult): Promise<SourceResult> {
  const live = r.items.filter((e) => !e.demo);
  if (live.length < 3 || r.source === "website" || r.source === "manus_research") return r;
  const out = await structured(
    { db: ctx.db, runId: ctx.run.id, phase: "research" },
    {
      route: "chat",
      system: loadPrompt("relevance"),
      user: JSON.stringify({
        brand: ctx.brand.name,
        what: ctx.brand.dossier.oneLiner,
        buyerProblems: ctx.brand.dossier.personas.flatMap((p) => p.pains).slice(0, 6),
        items: live.map((e) => ({ id: e.id, title: e.title, author: e.author, text: e.text?.slice(0, 200) })),
      }),
      schema: Relevance,
      note: `research: relevance ${r.source}`,
      maxTokens: 4000,
      demo: () => ({ keep: live.map((e) => e.id) }),
    },
  ).catch(() => null);
  if (!out) return r;
  const keep = new Set(out.value.keep);
  const kept = r.items.filter((e) => e.demo || keep.has(e.id));
  const dropped = r.items.length - kept.length;
  if (dropped > 0)
    await ctx.emit("thinking", `Dropped ${dropped} off-topic ${r.source} items`, {
      data: { source: r.source, dropped },
    });
  return { ...r, items: kept };
}

export const Deconstructions = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      hook: z.string(),
      format: z.string(),
      angle: z.string(),
      emotion: z.string(),
      cta: z.string(),
      beats: z.array(z.object({ t: z.number(), what: z.string() })),
      lengthSec: z.number().optional(),
      language: z.string(),
      whyItWorks: z.string(),
    }),
  ),
});

const SOURCE_LABEL: Partial<Record<EvidenceSource, string>> = {
  spiral: "spiral_ads_search",
  meta_ad_library: "search_meta_ads",
  tiktok: "search_tiktok",
  instagram: "search_instagram",
  youtube: "search_youtube_shorts",
  reddit: "search_reddit",
  manus_research: "manus_deep_research",
  website: "brand_site",
};

/** Demo search plan from what the brand's demo evidence and dossier already say. */
function demoPlan(ctx: PhaseCtx): ResearchPlan {
  const b = ctx.brand;
  const tags = [...new Set((ctx.demo?.evidence ?? []).flatMap((e) => e.tags))]
    .filter((t) => /^[a-z-]+$/.test(t))
    .slice(0, 4);
  const words = (b.dossier.oneLiner || b.name)
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .split(" ")
    .filter((w) => w.length > 3);
  return {
    tiktokHashtags: tags.length ? tags : words.slice(0, 3),
    tiktokQueries: [b.dossier.oneLiner || b.name],
    instagramHashtags: tags.slice(0, 2),
    youtubeQueries: [b.dossier.oneLiner || b.name],
    redditQueries: [b.dossier.personas[0]?.pains[0] ?? b.name],
    subreddits: [],
    adQueries: words.slice(0, 2),
    adCountry: b.countries[0] ?? "GB",
    spiralQuery: `${b.dossier.oneLiner || b.name} video ads`,
    rationale: "Demo plan built from the dossier and demo evidence tags.",
  };
}

export async function research(ctx: PhaseCtx): Promise<void> {
  const { db, run, brand } = ctx;
  const limit = Number(process.env.RESEARCH_ITEMS_PER_SOURCE ?? 20) || 20;
  const sctx: SourceCtx = {
    db,
    runId: run.id,
    brand,
    signal: ctx.signal,
    demoEvidence: ctx.demo?.evidence ?? [],
    limit,
  };

  // 1. Plan the searches (Claude decides what to look for)
  const planOut = await structured(
    { db, runId: run.id, phase: "research" },
    {
      route: "extraction",
      system: loadPrompt("research_plan", { rulePack: rulePackText(brand.rulePack) }),
      user: JSON.stringify({
        brand: brand.name,
        url: brand.url,
        vertical: brand.vertical,
        countries: brand.countries,
        languages: brand.languages,
        oneLiner: brand.dossier.oneLiner,
        positioning: brand.dossier.positioning,
        personas: brand.dossier.personas.map((p) => ({ name: p.name, pains: p.pains, whereTheyAre: p.whereTheyAre })),
      }),
      schema: ResearchPlan,
      note: `research: search plan for ${brand.slug}`,
      maxTokens: 4000,
      demo: () => demoPlan(ctx),
    },
  );
  const plan = planOut.value;
  await ctx.emit("thinking", `Search plan: ${plan.rationale}`, { data: plan });
  ctx.check();

  // 2. Manus deep research runs in parallel with everything else
  const manus = await startLandscape(sctx).catch(async (e) => {
    await ctx.emit("warning", "Manus task could not start; continuing without it", { detail: String(e) });
    return { task: null, mode: "demo" as const };
  });
  if (manus.task?.task_url) {
    await updateRun(db, run.id, { manusTaskUrl: manus.task.task_url });
    await ctx.emit("tool_call", "manus_deep_research started", {
      detail: manus.task.task_url,
      data: { tool: "manus_deep_research", provider: "manus", taskUrl: manus.task.task_url },
    });
  }

  // 3. Sources in parallel; each result is stored and streamed as it lands
  const all: Evidence[] = [];
  const store = async (r0: SourceResult) => {
    const r = r0.mode === "live" ? await relevant(ctx, r0) : r0;
    const label = SOURCE_LABEL[r.source] ?? r.source;
    await ctx.emit("tool_call", `${label} (${r.mode})`, { data: { tool: label, source: r.source, mode: r.mode } });
    scoreOutliers(r.items);
    r.items.forEach(tagLongevity);
    await upsertEvidence(db, r.items);
    all.push(...r.items);
    for (const e of [...r.items].sort((a, b) => winnerRank(b) - winnerRank(a))) {
      await ctx.emit("evidence", e.title, {
        refId: e.id,
        detail: e.deconstruction?.hook ? `Hook: ${e.deconstruction.hook}` : e.text?.slice(0, 160),
        data: { source: e.source, kind: e.kind, metrics: e.metrics, demo: e.demo },
      });
    }
    await ctx.emit("tool_result", `${r.items.length} ${r.source} items${r.mode === "demo" ? " (demo data)" : ""}`, {
      data: { source: r.source, mode: r.mode, usd: r.usd },
    });
  };
  const guard = (p: Promise<SourceResult>, source: EvidenceSource) =>
    p.then(store).catch(async (e) => {
      await ctx.emit("warning", `${source} failed: continuing with the other sources`, {
        detail: e instanceof Error ? e.message : String(e),
      });
    });

  // own site as evidence: real (from the intake crawl) when the crawl was live, else the demo item
  const siteLive = isLive("firecrawl");
  const site = siteLive ? [] : (ctx.demo?.evidence.filter((e) => e.source === "website") ?? []);
  if (!site.length) {
    const e = baseEvidence(sctx, "website", "page", `${brand.name} website: ${brand.dossier.oneLiner}`);
    e.url = brand.url;
    e.text = brand.dossier.positioning.slice(0, 1000);
    e.tags = ["own-site"];
    site.push(e);
  }
  await store({ source: "website", items: site, mode: site[0].demo ? "demo" : "live", usd: 0 });

  await Promise.all([
    guard(spiralWinners(sctx, plan.spiralQuery, brand.languages), "spiral"),
    guard(metaAdsSearch(sctx, plan.adQueries, plan.adCountry || brand.countries[0] || "GB"), "meta_ad_library"),
    guard(tiktokSearch(sctx, plan.tiktokHashtags, plan.tiktokQueries), "tiktok"),
    guard(instagramSearch(sctx, plan.instagramHashtags), "instagram"),
    guard(youtubeShorts(sctx, plan.youtubeQueries, brand.languages[0]), "youtube"),
    guard(
      redditSearch(sctx, plan.redditQueries.length ? plan.redditQueries : plan.subreddits, plan.subreddits[0]),
      "reddit",
    ),
    // demo-only sources the bundle has (reviews) pass through as-is, only when Apify itself is in demo
    (async () => {
      if (isLive("apify")) return;
      const extra = (ctx.demo?.evidence ?? []).filter((e) =>
        ["app_store", "play_store", "google_maps", "trustpilot"].includes(e.source),
      );
      if (extra.length) await store({ source: extra[0].source, items: extra, mode: "demo", usd: 0 });
    })(),
  ]);
  ctx.check();

  // 4. Deconstruct the top live winners that have no hook yet (one batched Claude call)
  const todo = all
    .filter((e) => !e.demo && (e.kind === "video" || e.kind === "ad") && !e.deconstruction?.hook)
    .sort((a, b) => winnerRank(b) - winnerRank(a))
    .slice(0, 12);
  if (todo.length) {
    const dec = await structured(
      { db, runId: run.id, phase: "research" },
      {
        route: "extraction",
        system: loadPrompt("deconstruct"),
        user: JSON.stringify(
          todo.map((e) => ({
            id: e.id,
            platform: e.source,
            title: e.title,
            author: e.author,
            metrics: e.metrics,
            text: e.text?.slice(0, 900),
            lengthSec: e.deconstruction?.lengthSec,
          })),
        ),
        schema: Deconstructions,
        note: `research: deconstruct ${todo.length} winners`,
        demo: () => ({ items: [] }),
      },
    ).catch(async (e) => {
      await ctx.emit("warning", "Deconstruction failed; continuing with raw evidence", {
        detail: e instanceof Error ? e.message : String(e),
      });
      return { value: { items: [] as z.infer<typeof Deconstructions>["items"] }, mode: "demo" as const, usd: 0 };
    });
    for (const d of dec.value.items) {
      const e = todo.find((x) => x.id === d.id);
      if (!e) continue;
      e.deconstruction = {
        ...e.deconstruction,
        hook: d.hook,
        format: d.format,
        angle: d.angle,
        emotion: d.emotion,
        cta: d.cta || e.deconstruction?.cta,
        beats: d.beats.length ? d.beats : undefined,
        lengthSec: d.lengthSec ?? e.deconstruction?.lengthSec,
        language: d.language,
      };
      e.tags = [...new Set([...e.tags, "deconstructed"])];
    }
    await upsertEvidence(db, todo);
    await ctx.emit("thinking", `Deconstructed ${dec.value.items.length} winners: hooks, formats, beats, CTAs`);
  } else {
    const n = all.filter((e) => e.deconstruction?.hook).length;
    await ctx.emit("thinking", `Deconstructed ${n} winners: hooks, formats, beats, CTAs`);
  }

  // 5. Manus result (bounded wait; the task link stays on the run either way)
  const waitMs = (Number(process.env.MANUS_WAIT_SEC ?? 420) || 420) * 1000;
  const m = await finishLandscape(sctx, manus.task, {
    timeoutMs: waitMs,
    onProgress: (b) => void ctx.emit("log", `Manus: ${b}`, { data: { provider: "manus" } }),
  }).catch(async (e) => {
    await ctx.emit("warning", "Manus result unavailable", { detail: String(e) });
    return null;
  });
  if (m) await store(m);

  const sources = new Set(all.map((e) => e.source));
  await ctx.emit("thinking", `${all.length} evidence items from ${sources.size} sources`, {
    data: { bySource: Object.fromEntries([...sources].map((s) => [s, all.filter((e) => e.source === s).length])) },
  });
}
