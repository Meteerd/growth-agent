/** pnpm export-showcase <runId>: put a finished live run (+ its flagship video) into the repo for any machine. */
import { loadEnv } from "./env";

loadEnv();
const { getDb } = await import("@/engine/db/client");
const { exportShowcase } = await import("@/engine/live/showcase");
console.log(await exportShowcase(await getDb(), process.argv[2]));
