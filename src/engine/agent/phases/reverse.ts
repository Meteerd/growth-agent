import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { type Blueprint, Blueprint as BlueprintSchema, type Evidence } from "@/contracts";
import { newId } from "../../ids";
import { detectScenes, extractAudio, extractFrame, probe, sampleTimes } from "../../media/ffmpeg";
import { makeSyntheticVideo } from "../../media/synthetic";
import { fetchRetry } from "../../providers/http";
import { type Transcript, transcribe } from "../../providers/openai";
import { listEvidence, upsertBlueprint } from "../../repo";
import { winnerRank } from "../../research/metrics";
import { type BetaContentBlockParam, loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";

export const BlueprintDraft = BlueprintSchema.omit({
  id: true,
  evidenceId: true,
  brandId: true,
  runId: true,
  frames: true,
  demo: true,
  createdAt: true,
});
export type BlueprintDraft = z.infer<typeof BlueprintDraft>;

const ASSETS = () => path.resolve(process.env.ASSETS_DIR || "data/assets");
const MEDIA = () => path.resolve("data/media");

export interface Watched {
  file: string;
  info: Awaited<ReturnType<typeof probe>>;
  cuts: number[];
  frames: { t: number; file: string; url: string }[];
  transcript: Transcript;
}

/** Watch a local video: scene cuts, frames (dense in the hook), audio transcript. */
export async function watchVideo(
  ctx: Pick<PhaseCtx, "db" | "run">,
  file: string,
  key: string,
  providedTranscript?: Transcript,
): Promise<Watched> {
  const info = await probe(file);
  if (!(info.durationSec >= 1)) throw new Error("not a playable video (corrupted or empty download)");
  if (info.durationSec > 180)
    throw new Error(`video too long to analyse (${Math.round(info.durationSec)} s; max 180 s)`);
  const clean = (xs: number[]) =>
    xs.filter((c, i, arr) => c > 0.2 && c < info.durationSec - 0.2 && (i === 0 || c - arr[i - 1] >= 0.4));
  let cuts = clean(await detectScenes(file));
  // single-take or soft-cut videos: try a lower threshold before giving up
  if (cuts.length < 2 && info.durationSec > 6) {
    const soft = clean(await detectScenes(file, 0.15));
    if (soft.length > cuts.length) cuts = soft;
  }
  const times = sampleTimes(info.durationSec, cuts, 20, cuts.length < 2 ? 1.5 : undefined);
  const dir = path.join(ASSETS(), "frames", key);
  const frames = [];
  for (const t of times) {
    const out = path.join(dir, `${t.toFixed(2)}.jpg`);
    await extractFrame(file, t, out);
    frames.push({ t, file: out, url: `/api/assets/frames/${key}/${t.toFixed(2)}.jpg` });
  }
  let transcript: Transcript = providedTranscript ?? { text: "", segments: [], source: "none" };
  if (!providedTranscript) {
    const audio = await extractAudio(file, path.join(MEDIA(), `${key}.mp3`)).catch(() => null);
    if (audio) {
      const r = await transcribe(ctx.db, audio, {
        runId: ctx.run.id,
        demo: () => ({ text: "", segments: [], source: "none" }),
      });
      transcript = r.t;
    }
  }
  return { file, info, cuts, frames, transcript };
}

/** Deterministic blueprint from cuts + transcript + known text (demo mode and fallback). */
export function heuristicBlueprint(
  w: Watched,
  ev: Pick<Evidence, "metrics" | "deconstruction" | "title">,
  texts: string[] = [],
): BlueprintDraft {
  const bounds = [0, ...w.cuts, w.info.durationSec];
  const n = bounds.length - 1;
  const purposes = (i: number): BlueprintDraft["shots"][number]["purpose"] =>
    i === 0 ? "hook" : i === n - 1 ? "cta" : i === 1 ? "problem" : i === n - 2 ? "proof" : "solution";
  const vo = (a: number, b: number) =>
    w.transcript.segments
      .filter((s) => s.start < b && s.end > a)
      .map((s) => s.text)
      .join(" ") || undefined;
  const shots = bounds.slice(0, -1).map((t0, i) => ({
    idx: i,
    t0,
    t1: bounds[i + 1],
    shotType: (texts[i] ? "text_card" : "broll") as BlueprintDraft["shots"][number]["shotType"],
    camera: "static",
    subject: texts[i] ? "text card" : "scene",
    action: texts[i] ? `on-screen text: ${texts[i]}` : "see frames",
    onScreenText: texts[i],
    voiceover: vo(t0, bounds[i + 1]),
    transition: i === 0 ? undefined : "hard cut",
    purpose: purposes(i),
  }));
  const days = ev.metrics.daysRunning;
  return {
    durationSec: w.info.durationSec,
    aspect: w.info.width && w.info.height && w.info.width > w.info.height ? "16:9" : "9:16",
    structure: "problem_agitate_solve",
    hook: {
      endSec: shots[0]?.t1 ?? 2,
      visual: shots[0]?.action ?? "",
      spoken: shots[0]?.voiceover,
      onScreenText: texts[0] ?? ev.deconstruction?.hook,
      mechanism: ev.deconstruction?.angle ?? "curiosity gap",
      whyItStops: "Opens a question the viewer wants answered (heuristic, demo).",
    },
    shots,
    pacing: {
      cutsPer10s: Math.round((w.cuts.length / w.info.durationSec) * 100) / 10,
      avgShotSec: Math.round((w.info.durationSec / n) * 10) / 10,
    },
    emotionalArc: ev.deconstruction?.emotion ?? "problem to relief",
    cta: { atSec: shots.at(-1)?.t0 ?? 0, mechanic: "end card", text: texts.at(-1) },
    whyItWins: days
      ? `${days} days running suggests it converts. Heuristic blueprint (demo mode).`
      : `Outlier score ${ev.metrics.outlierScore ?? "n/a"}. Heuristic blueprint (demo mode).`,
    transcript: w.transcript.text || undefined,
  };
}

function normalizeShots(d: BlueprintDraft, duration: number): BlueprintDraft {
  const shots = [...d.shots].sort((a, b) => a.t0 - b.t0).map((s, i) => ({ ...s, idx: i }));
  if (shots.length) {
    shots[0].t0 = 0;
    shots[shots.length - 1].t1 = duration || shots[shots.length - 1].t1;
    for (let i = 1; i < shots.length; i++) shots[i].t0 = shots[i - 1].t1;
  }
  return { ...d, durationSec: duration || d.durationSec, shots };
}

/** Claude vision over ordered frames + transcript -> Blueprint. */
export async function blueprintFromWatch(
  ctx: Pick<PhaseCtx, "db" | "run" | "brand">,
  ev: Evidence,
  w: Watched,
  o: { demoTexts?: string[]; key: string },
): Promise<Blueprint> {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: JSON.stringify({
        title: ev.title,
        platform: ev.source,
        author: ev.author,
        metrics: ev.metrics,
        durationSec: w.info.durationSec,
        size: `${w.info.width}x${w.info.height}`,
        sceneCuts: w.cuts,
        transcript: w.transcript.segments.length ? w.transcript.segments : w.transcript.text || "(no speech)",
        caption: ev.text?.slice(0, 600),
      }),
    },
  ];
  for (const f of w.frames) {
    content.push({ type: "text", text: `t=${f.t.toFixed(2)}s` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") },
    });
  }
  const r = await structured(
    { db: ctx.db, runId: ctx.run.id, phase: "reverse_engineer" },
    {
      route: "vision",
      system: loadPrompt("blueprint"),
      user: content,
      schema: BlueprintDraft,
      note: `reverse-engineer: blueprint for ${ev.id}`,
      demo: () => heuristicBlueprint(w, ev, o.demoTexts),
    },
  );
  const draft = normalizeShots(r.value, w.info.durationSec);
  return BlueprintSchema.parse({
    ...draft,
    id: newId("bp"),
    evidenceId: ev.id,
    brandId: ctx.brand.id,
    runId: ctx.run.id,
    sourceUrl: ev.url,
    frames: w.frames.map((f) => ({ t: f.t, url: f.url })),
    demo: r.mode === "demo",
    createdAt: new Date().toISOString(),
  });
}

async function download(url: string, out: string, signal?: AbortSignal): Promise<string> {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const res = await fetchRetry(url, { signal, timeoutMs: 120_000, headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 80 * 1024 * 1024) throw new Error("video too large (> 80 MB)");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) throw new Error("download too small to be a video");
  fs.writeFileSync(out, buf);
  return out;
}

/** Blueprint from Spiral's own structural analysis when we have no media (text only, cheaper). */
export async function blueprintFromAnalysis(
  ctx: Pick<PhaseCtx, "db" | "run" | "brand">,
  ev: Evidence,
): Promise<Blueprint | null> {
  const beats = ev.deconstruction?.beats ?? [];
  if (beats.length < 2) return null;
  const len = ev.deconstruction?.lengthSec ?? (beats.at(-1)?.t ?? 0) + 3;
  const w: Watched = {
    file: "",
    info: { durationSec: len, hasAudio: true },
    cuts: beats.slice(1).map((b) => b.t),
    frames: [],
    transcript: { text: ev.text ?? "", segments: [], source: "provided" },
  };
  const r = await structured(
    { db: ctx.db, runId: ctx.run.id, phase: "reverse_engineer" },
    {
      route: "extraction",
      system: loadPrompt("blueprint"),
      user: `No frames available; build the blueprint from this creative analysis and transcript. Mark visuals you cannot know as "not visible in analysis".\n${JSON.stringify({ title: ev.title, metrics: ev.metrics, deconstruction: ev.deconstruction, text: ev.text })}`,
      schema: BlueprintDraft,
      note: `reverse-engineer: blueprint (analysis) for ${ev.id}`,
      demo: () =>
        heuristicBlueprint(
          w,
          ev,
          beats.map((b) => b.what),
        ),
    },
  );
  const draft = normalizeShots(r.value, len);
  return BlueprintSchema.parse({
    ...draft,
    id: newId("bp"),
    evidenceId: ev.id,
    brandId: ctx.brand.id,
    runId: ctx.run.id,
    sourceUrl: ev.url,
    frames: [],
    demo: r.mode === "demo",
    createdAt: new Date().toISOString(),
  });
}

/** Analyze the synthetic test video (demo pipeline check; no third-party media). */
export async function syntheticBlueprint(
  ctx: Pick<PhaseCtx, "db" | "run" | "brand">,
  ev: Evidence,
): Promise<Blueprint> {
  const key = `synthetic_${ctx.run.id.slice(-6)}`;
  const v = await makeSyntheticVideo(path.join(MEDIA(), key));
  let t = 0;
  const segments = v.scenes.map((s) => {
    const seg = { start: t, end: t + s.durationSec, text: s.text };
    t += s.durationSec;
    return seg;
  });
  const w = await watchVideo(ctx, v.file, key, { text: v.voiceover, segments, source: "provided" });
  return blueprintFromWatch(ctx, ev, w, { key, demoTexts: v.scenes.map((s) => s.text) });
}

export async function reverseEngineer(ctx: PhaseCtx): Promise<void> {
  const { db, run } = ctx;
  const evidence = await listEvidence(db, run.id);
  const max = Number(process.env.BLUEPRINTS_PER_RUN ?? 3) || 3;
  const candidates = evidence
    .filter((e) => (e.kind === "video" || e.kind === "ad") && !e.demo)
    .sort((a, b) => winnerRank(b) - winnerRank(a));
  const out: Blueprint[] = [];

  for (const ev of candidates) {
    if (out.length >= max) break;
    ctx.check();
    try {
      if (ev.mediaUrl) {
        await ctx.emit("tool_call", `watch_video: ${ev.title}`, {
          refId: ev.id,
          data: { tool: "watch_video", evidenceId: ev.id },
        });
        const key = ev.id.replace(/[^a-z0-9_]/gi, "_");
        const file = await download(ev.mediaUrl, path.join(MEDIA(), `${key}.mp4`), ctx.signal);
        const provided =
          ev.source === "spiral" && ev.text?.includes("Transcript:")
            ? { text: ev.text.split("Transcript:")[1].trim(), segments: [], source: "provided" as const }
            : undefined;
        const w = await watchVideo(ctx, file, key, provided);
        await ctx.emit(
          "tool_result",
          `${w.cuts.length + 1} shots, ${w.frames.length} frames, transcript ${w.transcript.source}`,
          { refId: ev.id },
        );
        out.push(await blueprintFromWatch(ctx, ev, w, { key }));
      } else if (ev.deconstruction?.beats?.length) {
        const bp = await blueprintFromAnalysis(ctx, ev);
        if (bp) out.push(bp);
      }
    } catch (e) {
      await ctx.emit("warning", `Could not watch ${ev.title}: skipped`, {
        detail: e instanceof Error ? e.message : String(e),
        refId: ev.id,
      });
    }
    const bp = out.at(-1);
    if (bp && bp.evidenceId === ev.id) {
      await upsertBlueprint(db, bp);
      await ctx.emit(
        "blueprint",
        `Blueprint: ${bp.shots.length} shots, ${bp.structure}, hook ends at ${bp.hook.endSec}s`,
        { refId: bp.id, detail: bp.whyItWins },
      );
    }
  }

  // Demo data for seeded brands: their recorded blueprints (no third-party media needed)
  if (!out.length && ctx.demo?.blueprints.length) {
    for (const bp of ctx.demo.blueprints) {
      const src = ctx.demo.evidence.find((e) => e.id === bp.evidenceId);
      await ctx.emit("tool_call", `watch_video: ${src?.title ?? bp.evidenceId}`, {
        data: { tool: "watch_video", evidenceId: bp.evidenceId, demo: true },
      });
      await upsertBlueprint(db, bp);
      out.push(bp);
      await ctx.emit(
        "blueprint",
        `Blueprint: ${bp.shots.length} shots, ${bp.structure}, hook ends at ${bp.hook.endSec}s`,
        { refId: bp.id, detail: bp.whyItWins },
      );
    }
  }
  if (!out.length)
    await ctx.emit(
      "warning",
      "No winning videos with media or structure found; production will work from the deconstructions only",
    );
}
