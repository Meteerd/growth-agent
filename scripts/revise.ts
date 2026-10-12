/**
 * pnpm revise <conceptId> "<message>" [--wait] [--choose]
 * A19 from the command line: plan + render a revision (same engine as POST /api/concepts/:id/revise).
 */
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "fal,higgsfield,elevenlabs,gemini";
const { getDb } = await import("@/engine/db/client");
const { revise, chooseVersion } = await import("@/engine/revise");
const repo = await import("@/engine/repo");
const db = await getDb();
const [id, message] = process.argv.slice(2);
const t0 = Date.now();
const r = await revise(db, id!, message!);
console.log(JSON.stringify(r, null, 2), `planned in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (r.status === "queued" && process.argv.includes("--wait")) {
  let v = (await repo.listRenderVersions(db, id!)).find((x) => x.id === r.renderId)!;
  let readyAt = 0;
  while (v.status === "rendering" || (v.status === "ready" && !v.review)) {
    await new Promise((res) => setTimeout(res, 2000));
    v = (await repo.listRenderVersions(db, id!)).find((x) => x.id === r.renderId)!;
    if (v.status === "ready" && !readyAt) {
      readyAt = Date.now();
      console.log(`video ready in ${((readyAt - t0) / 1000).toFixed(1)} s: ${v.assetUrl}`);
    }
    if (v.status === "failed") break;
  }
  console.log(JSON.stringify({ status: v.status, error: v.error, review: v.review, costUsd: v.costUsd }, null, 2));
  if (process.argv.includes("--choose") && v.status === "ready")
    console.log("chosen", (await chooseVersion(db, id!, v.id)).version);
}
process.exit(0);
