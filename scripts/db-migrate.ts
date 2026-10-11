import { loadEnv } from "./env";

loadEnv();
const { createDb } = await import("@/engine/db/client");
await createDb();
console.log(`db:migrate ok (${process.env.DATABASE_URL || "file:./data/nexus.db"})`);
