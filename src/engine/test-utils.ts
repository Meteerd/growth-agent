import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, type Db, setDb } from "./db/client";

/** Fresh temp SQLite file wired in as the process DB. Never touches data/nexus.db. */
export async function freshDb(): Promise<Db> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-test-"));
  const db = createDb(`file:${path.join(dir, "test.db")}`);
  setDb(db);
  (globalThis as unknown as { __nexusSeeded?: unknown }).__nexusSeeded = undefined;
  return db;
}

export function ctx<P extends Record<string, string | string[]>>(params: P) {
  return { params: Promise.resolve(params) } as never;
}

export function req(url: string, init?: RequestInit & { json?: unknown }): Request {
  const { json, ...rest } = init ?? {};
  return new Request(`http://localhost${url}`, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json), headers: { "content-type": "application/json" } } : {}),
  });
}
