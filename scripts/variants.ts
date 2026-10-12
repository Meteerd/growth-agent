/** pnpm variants <conceptId> <shotIdx...>: A19 alternatives per shot from fal and Higgsfield (operator picks). */
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "fal,higgsfield";
const { getDb } = await import("@/engine/db/client");
const { makeVariants, listVariants } = await import("@/engine/revise");
const db = await getDb();
const [id, ...shots] = process.argv.slice(2);
await makeVariants(db, id!, ["fal", "higgsfield"], shots.map(Number));
const v = await listVariants(db, id!);
console.log(
  JSON.stringify(
    v.shots.filter((s) => shots.map(Number).includes(s.idx)),
    null,
    1,
  ),
);
process.exit(0);
