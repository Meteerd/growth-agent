import { beforeEach, describe, expect, it } from "vitest";
import { GET as getAsset } from "@/app/api/assets/[...path]/route";
import { GET as getConnections, POST as postConnection } from "@/app/api/brands/[id]/connections/route";
import { PATCH as patchDossier } from "@/app/api/brands/[id]/dossier/route";
import { GET as getBrand } from "@/app/api/brands/[id]/route";
import { POST as createBrand, GET as listBrands } from "@/app/api/brands/route";
import { GET as getProviders } from "@/app/api/providers/route";
import { Brand as BrandSchema, BrandsResponse, Connection, ProviderStatus } from "@/contracts";
import { getDb } from "@/engine/db/client";
import { waitForRun } from "@/engine/jobs/runner";
import { patchDossier as patchRepo } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { ctx, freshDb, req } from "@/engine/test-utils";

describe("brands API (temp SQLite)", () => {
  beforeEach(async () => {
    await freshDb();
  });

  it("GET /api/brands returns the four seeded brands with counts", async () => {
    const res = await listBrands();
    expect(res.status).toBe(200);
    const brands = BrandsResponse.parse(await res.json());
    expect(brands.map((b) => b.slug).sort()).toEqual(["aclinic", "dynova", "evreon", "hound"]);
    const hound = brands.find((b) => b.slug === "hound")!;
    expect(hound.counts.runs).toBeGreaterThanOrEqual(1);
    expect(hound.counts.packsReady).toBeGreaterThanOrEqual(4);
    expect(hound.counts.totalViews).toBe(0);
    expect(["done", "running"]).toContain(hound.lastRun?.status);
  });

  it("seed is idempotent", async () => {
    const db = await getDb();
    await seed(db);
    const again = await seed(db);
    expect(again.brandsCreated).toBe(0);
    const brands = BrandsResponse.parse(await (await listBrands()).json());
    expect(brands).toHaveLength(4);
  });

  it("GET /api/brands/:id works by id and slug, 404 otherwise", async () => {
    const bySlug = BrandSchema.parse(await (await getBrand(req("/api/brands/hound"), ctx({ id: "hound" }))).json());
    expect(bySlug.name).toBe("Hound");
    const byId = await getBrand(req("/api/brands/brand_hound"), ctx({ id: "brand_hound" }));
    expect(byId.status).toBe(200);
    const missing = await getBrand(req("/api/brands/nope"), ctx({ id: "nope" }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: { code: "not_found", message: "Brand not found" } });
  });

  it("POST /api/brands creates a brand and an intake run", async () => {
    const res = await createBrand(req("/api/brands", { method: "POST", json: { url: "example.com" } }));
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.brand.slug).toBe("example");
    expect(out.brand.url).toBe("https://example.com");
    expect(out.run.phase).toBe("intake");
    await waitForRun(out.run.id);
    const bad = await createBrand(req("/api/brands", { method: "POST", json: { url: "not a url" } }));
    expect(bad.status).toBe(400);
  });

  it("PATCH dossier locks operator fields against later crawls", async () => {
    const res = await patchDossier(
      req("/api/brands/hound/dossier", { method: "PATCH", json: { oneLiner: "Operator one-liner" } }),
      ctx({ id: "hound" }),
    );
    const b = BrandSchema.parse(await res.json());
    expect(b.dossier.oneLiner).toBe("Operator one-liner");
    expect(b.dossier.provenance?.find((p) => p.field === "oneLiner")?.source).toBe("operator");
    const db = await getDb();
    const after = await patchRepo(db, "brand_hound", { oneLiner: "Crawled guess", positioning: "Crawled" }, "crawl");
    expect(after?.dossier.oneLiner).toBe("Operator one-liner");
    expect(after?.dossier.positioning).toBe("Crawled");
  });

  it("connections list and create", async () => {
    const list = (await (
      await getConnections(req("/api/brands/hound/connections"), ctx({ id: "hound" }))
    ).json()) as unknown[];
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) Connection.parse(c);
    const res = await postConnection(
      req("/api/brands/hound/connections", {
        method: "POST",
        json: { provider: "posthog", config: { projectId: "123" } },
      }),
      ctx({ id: "hound" }),
    );
    expect(res.status).toBe(201);
    const c = Connection.parse(await res.json());
    expect(c.config.projectId).toBe("123");
  });

  it("GET /api/providers is demo for everything in tests", async () => {
    const list = ((await (await getProviders()).json()) as unknown[]).map((p) => ProviderStatus.parse(p));
    expect(list).toHaveLength(17);
    expect(list.every((p) => p.mode === "demo")).toBe(true);
  });

  it("GET /api/assets serves brand files and blocks traversal", async () => {
    const ok = await getAsset(
      req("/api/assets/brands/hound/logo-icon.png"),
      ctx({ path: ["brands", "hound", "logo-icon.png"] }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    const evil = await getAsset(req("/api/assets/../.env"), ctx({ path: ["..", ".env"] }));
    expect(evil.status).toBe(404);
  });

  it("serves Unicode file names (Turkish, Slovak) and blocks traversal under brands/", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const { fileToUrl, urlToFile } = await import("@/engine/video/files");
    const dir = path.join(os.tmpdir(), `nexus-uni-${Date.now()}`);
    process.env.ASSETS_DIR = dir;
    const f = path.join(dir, "runs", "çğış", "kľúč šťava.png");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.copyFileSync("assets/brands/hound/logo-icon.png", f);
    const url = fileToUrl(f);
    expect(url).not.toMatch(/[^\x20-\x7e]/);
    expect(urlToFile(url)).toBe(f);
    const parts = decodeURIComponent(url.replace("/api/assets/", "")).split("/");
    const res = await getAsset(req(url), ctx({ path: parts }));
    expect(res.status).toBe(200);
    const evil = await getAsset(req("/api/assets/brands/../../.env"), ctx({ path: ["brands", "..", "..", ".env"] }));
    expect(evil.status).toBe(404);
    expect(urlToFile("/api/assets/brands/..%2F..%2F.env")).toBeNull();
  });

  it("builds a missing video poster on demand", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const { makeSyntheticVideo } = await import("@/engine/media/synthetic");
    const dir = path.join(os.tmpdir(), `nexus-poster-${Date.now()}`);
    process.env.ASSETS_DIR = dir;
    const v = await makeSyntheticVideo(path.join(dir, "vids"));
    const rel = path.relative(dir, v.file).split(path.sep);
    const res = await getAsset(
      req(`/api/assets/${rel.join("/")}.poster.jpg`),
      ctx({ path: [...rel.slice(0, -1), `${rel.at(-1)}.poster.jpg`] }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(fs.existsSync(`${v.file}.poster.jpg`)).toBe(true);
  });
});
