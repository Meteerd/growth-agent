import type { Evidence } from "@/contracts";
import { baseEvidence, demoFor, num, type SourceCtx, type SourceResult, str } from "../research/types";
import { saveFixture } from "../smoke/record";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

const API = "https://public-api.spiral.ad/v1";
type J = Record<string, unknown>;

async function spiralGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchRetry(`${API}${path}`, {
    signal,
    headers: { Authorization: `Bearer ${process.env.SPIRAL_API_KEY}` },
    timeoutMs: 90_000,
  });
  return okJson<T>(res, `spiral ${path.split("?")[0]}`);
}

/** Map Spiral's video creative analysis onto our deconstruction (hook, format, beats, CTA). */
export function spiralDeconstruction(ad: J): Evidence["deconstruction"] {
  const a = (ad.creative_analysis ?? {}) as J;
  const hook = (a.hook ?? {}) as J;
  const arc = (a.structural_arc ?? []) as J[];
  const summary = (a.structural_summary ?? {}) as J;
  const persuasion = (a.persuasion_mechanism ?? {}) as J;
  const audience = (a.audience_signals ?? {}) as J;
  const last = arc.at(-1);
  return {
    hook: str(hook.exact_text_or_description),
    format: str(summary.narrative_structure) ?? str(summary.message_structure) ?? str(ad.creative_type),
    angle: str(persuasion.primary_lever),
    beats: arc.length
      ? arc.map((s) => ({
          t: num(s.start_seconds) ?? 0,
          what: [str(s.section), str(s.shown_or_said)].filter(Boolean).join(": "),
        }))
      : undefined,
    emotion: str(audience.emotional_state),
    cta: str(ad.cta_text) ?? str(summary.cta_description),
    lengthSec: num(last?.end_seconds),
    language: str(ad.language_code),
  };
}

export function normSpiralAd(ctx: SourceCtx, ad: J): Evidence {
  const page = ((ad.meta_page ?? {}) as J).brand as J | undefined;
  const brandName = str(page?.name) ?? str((ad.meta_page as J | undefined)?.name);
  const body = str(ad.body) ?? "";
  const e = baseEvidence(ctx, "spiral", "ad", `${brandName ?? "Advertiser"}: ${body.split("\n")[0] || "video ad"}`);
  e.author = brandName;
  e.url = str(ad.link_url);
  const creative = ((ad.creatives ?? []) as J[])[0];
  e.mediaUrl = str(ad.original_media_url) ?? str(creative?.original_media_url);
  e.thumbnailUrl = str(creative?.thumbnail_media_url) ?? str(creative?.preview_media_url);
  e.text = body.slice(0, 800) || undefined;
  const active = num(ad.total_active_time);
  const start = str(ad.start_date);
  const end = str(ad.end_date);
  const days =
    active !== undefined
      ? active > 1000
        ? Math.round(active / 86400)
        : active
      : start
        ? Math.round(((end ? Date.parse(end) : Date.now()) - Date.parse(start)) / 86400000)
        : undefined;
  e.metrics = { daysRunning: days };
  e.deconstruction = spiralDeconstruction(ad);
  const transcript = str(((ad.audio_transcript ?? {}) as J).full_text);
  if (transcript) e.text = `${e.text ? `${e.text}\n\n` : ""}Transcript: ${transcript}`.slice(0, 1500);
  e.tags = ["paid", "spiral", ...(ad.is_active ? ["active"] : [])];
  return e;
}

/** Spiral: natural-language search over Meta ads, then details (creative analysis + transcript). Credits metered. */
export async function spiralWinners(ctx: SourceCtx, query: string, languages: string[] = []): Promise<SourceResult> {
  const out = await callProvider(ctx.db, {
    provider: "spiral",
    note: `spiral ads search: ${query}`,
    runId: ctx.runId,
    estimateUsd: 0,
    demo: () => demoFor(ctx, "spiral"),
    live: async () => {
      const qs = new URLSearchParams({
        query,
        app_type: "app",
        limit: String(Math.min(ctx.limit, 10)),
        creative_type: "VIDEO",
        min_run_days: "14",
      });
      for (const l of languages.slice(0, 3)) qs.append("languages", l);
      const search = await spiralGet<{ data: J[] }>(`/ads/meta/search?${qs}`, ctx.signal);
      const uuids = search.data.map((d) => str(d.uuid)).filter((x): x is string => !!x);
      if (!uuids.length) return { result: [], usd: 0 };
      const details = await spiralGet<{ data: J[] }>(
        `/ads/meta?${uuids.map((u) => `uuids=${u}`).join("&")}`,
        ctx.signal,
      );
      saveFixture("spiral", `${ctx.brand.slug}_winners`, { query, search, details });
      return { result: details.data.map((d) => normSpiralAd(ctx, d)), usd: 0, units: `${uuids.length} ads (credits)` };
    },
  });
  return { source: "spiral", items: out.value, mode: out.mode, usd: out.usd };
}
