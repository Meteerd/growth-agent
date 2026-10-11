import fs from "node:fs";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

function ensureDir(url: string) {
  if (!url.startsWith("file:")) return;
  const file = url.slice("file:".length);
  if (file === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
}

export async function createDb(url = process.env.DATABASE_URL || "file:./data/nexus.db"): Promise<Db> {
  ensureDir(url);
  const client = createClient({ url });
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  const db = drizzle(client, { schema }) as Db;
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

const g = globalThis as unknown as { __nexusDb?: Promise<Db> };

/** Process-wide DB (survives Next.js dev hot reloads). Migrates on first use. */
export function getDb(): Promise<Db> {
  if (!g.__nexusDb) g.__nexusDb = createDb();
  return g.__nexusDb;
}

/** Tests: point the process-wide DB at a specific database. */
export function setDb(db: Promise<Db> | undefined) {
  g.__nexusDb = db;
}
