/**
 * pnpm english <conceptId> [--export]
 * English-first (Mete, 11:24): an English primary version of a flagship on the SAME clips. Claude translates the
 * voiceover, on-screen lines and CTA (natural English, same meaning, no new claims, readable pace); the brand's
 * rule pack re-checks them; the brand's cast voice speaks English (same persona); captions, music, SFX and the
 * real-site CTA (in English) are rebuilt. The original-language cut becomes this video's dub (language toggle).
 */
import path from "node:path";
import { z } from "zod";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "fal,elevenlabs,gemini";
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { structured } = await import("@/engine/agent/claude");
const { checkText } = await import("@/engine/compliance/check");
const { rulePackText } = await import("@/engine/rules");
const { readVoices, saveBrandVoice } = await import("@/engine/audio/voices");
const { buildA18 } = await import("@/engine/flagship-a18");
const { exportShowcase } = await import("@/engine/live/showcase");
const { nowIso } = await import("@/engine/ids");

const db = await getDb();
const id = process.argv[2]!;
const src = (await repo.getConcept(db, id))!;
const brand = (await repo.getBrand(db, src.brandId))!;
const enId = `${id}_en`;

const T = z.object({
  title: z.string(),
  cta: z.string(),
  shots: z.array(z.object({ idx: z.number(), voiceover: z.string(), onScreenText: z.string() })),
});
const tr = await structured(
  { db, runId: src.runId, phase: "production" },
  {
    route: "production",
    system: `Translate a short vertical video ad from ${src.language} into natural, spoken English for an English-speaking audience in Europe. Same meaning and structure shot for shot, no new claims, no stronger claims, plain words. Spoken lines must read at a calm pace (about 2.5 words per second of the shot's duration; shorten if needed, never add). On-screen lines: at most 7 words. Keep brand names, URLs and product names as they are. Rules that still apply:\n${rulePackText(brand.rulePack)}`,
    user: JSON.stringify({
      title: src.title,
      cta: src.cta,
      shots: src.shots.map((s) => ({ idx: s.idx, durationSec: s.durationSec, voiceover: s.voiceover ?? "", onScreenText: s.onScreenText ?? "" })),
    }),
    schema: T,
    note: `english version ${id}`,
    maxTokens: 4000,
    demo: () => ({ title: src.title, cta: src.cta, shots: src.shots.map((s) => ({ idx: s.idx, voiceover: s.voiceover ?? "", onScreenText: s.onScreenText ?? "" })) }),
  },
);
const shots = src.shots.map((s) => {
  const t = tr.value.shots.find((x) => x.idx === s.idx);
  return t ? { ...s, voiceover: t.voiceover || undefined, onScreenText: t.onScreenText || undefined } : s;
});
const check = await checkText(db, {
  brand,
  text: [tr.value.title, tr.value.cta, ...shots.flatMap((s) => [s.voiceover ?? "", s.onScreenText ?? ""])].join("\n"),
  targetType: "concept",
  targetId: enId,
  runId: src.runId,
});
await repo.insertCompliance(db, check);
if (check.status === "fail") {
  console.log("compliance failed:", JSON.stringify(check).slice(0, 600));
  process.exit(1);
}
await repo.upsertConcept(db, {
  ...src,
  id: enId,
  language: "en",
  title: tr.value.title,
  cta: tr.value.cta,
  shots,
  variantOf: id,
  videoAssetId: undefined,
  compliance: check.status,
  createdAt: nowIso(),
});

// the brand keeps its cast voice (same persona) speaking English
const book = readVoices()[brand.slug] ?? {};
if (!book.en) {
  const primary = book[src.language] ?? Object.values(book)[0]!;
  saveBrandVoice(brand.slug, { ...primary, language: "en", why: `${primary.why} English version: same voice (persona continuity), eleven_multilingual_v2.`, chosenAt: nowIso() });
}

const r = await buildA18(db, enId, {
  mode: "voice_led",
  animateAll: false,
  keepClips: true,
  rounds: 1,
  sheetPath: path.resolve("docs/renders", `${brand.slug}-flagship.jpg`),
  screenCta: { scrollPx: 260 },
});

// the market-language cut stays the main flagship; this English cut is its "en" version (served as heroVideo.dubs)
console.log(JSON.stringify({ concept: enId, video: r.asset.url, overall: r.review.overall, perShot: r.review.perShot.map((p) => p.score), notes: r.review.notes.slice(0, 600) }, null, 2));
if (process.argv.includes("--export")) console.log("export:", await exportShowcase(db, src.runId));
process.exit(0);
