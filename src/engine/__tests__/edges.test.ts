import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/engine/db/client";
import { fetchRetry } from "@/engine/providers/http";
import { getRun, listBlueprints, listConcepts, listEvents, listPacksByRun } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { createBrand } from "@/engine/services/brands";
import { freshDb, runToEnd } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-edges-${Date.now()}`);
  process.env.MANUS_WAIT_SEC = "1";
  db = await freshDb();
  await seed(db);
});

describe("edge cases", () => {
  it("a brand created at runtime with zero evidence and zero winners runs to packs without errors", async () => {
    const { brand } = await createBrand(db, { url: "https://example.com", name: "Example Co" });
    const runId = await runToEnd(db, brand.id);
    expect((await getRun(db, runId))?.status).toBe("done");
    expect(await listBlueprints(db, runId)).toHaveLength(0);
    expect((await listConcepts(db, runId)).length).toBeGreaterThan(0);
    expect((await listPacksByRun(db, runId)).length).toBeGreaterThan(0);
    const evs = await listEvents(db, runId);
    expect(evs.some((e) => e.type === "error")).toBe(false);
    expect(evs.some((e) => e.type === "warning" && /No winning videos/.test(e.title))).toBe(true);
  });

  it("fetchRetry retries 429/5xx with backoff and returns the first success", async () => {
    let n = 0;
    const server = http.createServer((_req, res) => {
      n++;
      if (n === 1) res.writeHead(503).end("busy");
      else if (n === 2) res.writeHead(429).end("slow down");
      else res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      const res = await fetchRetry(url, { retries: 2 });
      expect(res.status).toBe(200);
      expect(n).toBe(3);
    } finally {
      server.close();
    }
  }, 20_000);

  it("fetchRetry gives up after its retries and returns the last error response", async () => {
    const server = http.createServer((_req, res) => res.writeHead(500).end("down"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const res = await fetchRetry(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`, { retries: 1 });
      expect(res.status).toBe(500);
    } finally {
      server.close();
    }
  }, 20_000);
});
