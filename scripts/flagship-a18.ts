/**
 * pnpm flagship-a18 <conceptId> [--mode voice_led|picture_locked] [--animate-all] [--rounds 2] [--sheet <jpg>] [--export]
 * A18: ElevenLabs soundtrack + live captions + fal motion + Claude/Gemini review for one flagship.
 */
import { loadEnv } from "./env";

loadEnv();
const args = process.argv.slice(2);
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
process.env.NEXUS_FORCE_LIVE = "fal,higgsfield,elevenlabs,gemini";
const { getDb } = await import("@/engine/db/client");
const { buildA18 } = await import("@/engine/flagship-a18");
const { exportShowcase } = await import("@/engine/live/showcase");
const repo = await import("@/engine/repo");
const db = await getDb();
const t0 = Date.now();
const r = await buildA18(db, args[0]!, {
  mode: (arg("--mode") as "voice_led" | "picture_locked") ?? "voice_led",
  animateAll: args.includes("--animate-all"),
  rounds: Number(arg("--rounds") ?? 2),
  sheetPath: arg("--sheet"),
});
if (args.includes("--export")) console.log("export:", await exportShowcase(db, r.concept.runId));
const spend = await repo.listSpend(db, r.concept.runId);
console.log(
  JSON.stringify(
    {
      concept: r.concept.id,
      video: r.asset.url,
      durationSec: r.asset.durationSec,
      minutes: Math.round((Date.now() - t0) / 600) / 100,
      kept: {
        overall: r.review.overall,
        perShot: r.review.perShot.map((p) => p.score),
        notes: r.review.notes.slice(0, 900),
      },
      rounds: r.reviews.map((x) => ({ round: x.round, overall: x.overall, perShot: x.perShot.map((p) => p.score) })),
      sheet: r.sheet,
      runSpend: spend.reduce((a, s) => a + s.usd, 0).toFixed(2),
    },
    null,
    2,
  ),
);
process.exit(0);
