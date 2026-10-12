import { loadEnv } from "./env";

loadEnv();
const { createDb } = await import("@/engine/db/client");
await createDb();
console.log(`db:migrate ok (${process.env.DATABASE_URL || "file:./data/nexus.db"})`);

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
