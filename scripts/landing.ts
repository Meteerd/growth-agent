/** pnpm landing <packId>: Manus builds a landing page for a pack (forced live for this call; never published). */
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "manus";
const packId = process.argv[2];
const { getDb } = await import("@/engine/db/client");
const { buildLanding } = await import("@/engine/services/landing");
const { saveFixture } = await import("@/engine/smoke/record");
const db = await getDb();
const p = await buildLanding(db, packId);
console.log(JSON.stringify({ packId: p.id, landingUrl: p.landingUrl }, null, 2));
saveFixture("manus", "landing_start", { packId: p.id, landingUrl: p.landingUrl });

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
