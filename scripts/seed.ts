import { loadEnv } from "./env";

loadEnv();
const { createDb } = await import("@/engine/db/client");
const { seed } = await import("@/engine/seed");
const db = await createDb();
const r = await seed(db);
console.log(
  `seed ok: ${r.brandsCreated} brands created (others kept), ${r.runsImported} demo runs imported (existing kept)`,
);
const { prepareDemoMedia } = await import("@/engine/demo-media");
console.log(`demo media: ${await prepareDemoMedia(db)} files built`);

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
