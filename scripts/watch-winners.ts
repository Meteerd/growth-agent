/**
 * pnpm watch-winners [conceptId...]
 * A18: Gemini watches each flagship's winning ad (local file in data/media, never re-published) with sound and
 * records its caption style, music, sound effects and voice in the blueprint (additive fields).
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "gemini";
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { watchWinner, mergeWinnerWatch } = await import("@/engine/agent/watcher");
const FLAGSHIPS = ["concept_1d68be0a_1", "concept_1e6575ad_1", "concept_91d09027_1", "concept_f352d515_1"];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : FLAGSHIPS;
const db = await getDb();
for (const id of ids) {
  const c = await repo.getConcept(db, id);
  const bp = c?.blueprintId ? await repo.getBlueprint(db, c.blueprintId) : null;
  if (!c || !bp) {
    console.log(id, "no concept/blueprint");
    continue;
  }
  const base = bp.evidenceId.replace(/_[0-9a-f]{6}$/, "");
  const file = [path.resolve("data/media", `${base}.mp4`), path.resolve("data/media", `${bp.evidenceId}.mp4`)].find(
    (f) => fs.existsSync(f),
  );
  if (!file) {
    console.log(id, "winner media missing for", bp.evidenceId);
    continue;
  }
  const w = await watchWinner(db, file, c.runId);
  if (!w) {
    console.log(id, "gemini not live");
    continue;
  }
  await repo.upsertBlueprint(db, mergeWinnerWatch(bp, w));
  console.log(
    JSON.stringify(
      {
        id,
        bp: bp.id,
        captions: w.captions,
        hasHookTitle: w.hasHookTitle,
        hookTitle: w.hookTitle,
        music: w.music,
        sfx: w.sfx,
        voice: w.voice,
      },
      null,
      1,
    ),
  );
}
process.exit(0);
