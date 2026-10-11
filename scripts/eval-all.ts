/** pnpm eval-all: run `eval-run` on every finished full run in the local database and print a table. */
import { execFileSync } from "node:child_process";
import { loadEnv } from "./env";

loadEnv();
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const db = await getDb();
let failed = 0;
for (const b of await repo.listBrands(db)) {
  for (const r of await repo.listRuns(db, b.id)) {
    if (r.kind !== "full" || r.status !== "done") continue;
    try {
      const out = execFileSync("pnpm", ["-s", "eval-run", r.id], { encoding: "utf8" });
      console.log(out.trim().split("\n")[0]);
    } catch (e) {
      failed++;
      console.log(((e as { stdout?: string }).stdout ?? String(e)).trim());
    }
  }
}
process.exit(failed ? 1 : 0);
