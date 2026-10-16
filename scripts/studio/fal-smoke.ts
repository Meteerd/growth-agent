/** One image per fal model (about $0.30 total) to confirm the endpoints and the account work. */
import { loadEnv } from "../env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "fal";
const { getDb } = await import("@/engine/db/client");
const { genImage } = await import("@/engine/studio/images");
const db = await getDb();
const out = process.argv[2] ?? "/tmp/fal-smoke";
const models = (process.argv[3] ?? "fal:gpt-image-2.5-flare,fal:nano-banana-2.1,fal:seedream-5-lite").split(",");
const prompt =
  "A candid iPhone photo of a beagle sitting calmly by an apartment front door while its owner puts on shoes, warm morning light, real lived-in hallway. No text, no logos.";
for (const m of models) {
  const t0 = Date.now();
  try {
    const r = await genImage(db, { model: m as never, prompt, aspect: "4:5", out: `${out}/${m.replace(/[^a-z0-9.-]/gi, "_")}.png` });
    console.log(m, r.mode, r.model, `$${r.usd}`, `${Math.round((Date.now() - t0) / 1000)}s`, r.file);
  } catch (e) {
    console.log(m, "FAILED", e instanceof Error ? e.message.slice(0, 300) : e);
  }
}
process.exit(0);
