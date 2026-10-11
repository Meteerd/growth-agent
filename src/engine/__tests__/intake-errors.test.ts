import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCtx } from "@/engine/agent/context";
import { intake } from "@/engine/agent/phases/intake";
import type { Db } from "@/engine/db/client";
import * as fc from "@/engine/providers/firecrawl";
import { getBrand, listEvents } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { createBrand } from "@/engine/services/brands";
import { freshDb } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});
afterEach(() => vi.restoreAllMocks());

describe("intake edge cases", () => {
  it("an unreachable site does not kill the run: warnings, then a dossier from what we know", async () => {
    vi.spyOn(fc, "scrape").mockRejectedValue(new Error("Firecrawl 500: upstream timeout"));
    vi.spyOn(fc, "directFetch").mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const { brand, run } = await createBrand(db, { url: "https://unreachable.invalid", name: "Ghost" });
    const base = await makeCtx(db, run.id, new AbortController().signal);
    await intake(base.forPhase("intake"));
    const warnings = (await listEvents(db, run.id)).filter((e) => e.type === "warning").map((e) => e.title);
    expect(warnings).toEqual([
      "Firecrawl could not read the site; trying a direct fetch",
      "The site could not be read at all; continuing from what we know",
    ]);
    const after = await getBrand(db, brand.id);
    expect(after?.dossier.gaps.length).toBeGreaterThan(0);
  });

  it("Unicode brand names and URLs (Slovak, Turkish) get clean slugs", async () => {
    const a = await createBrand(db, { url: "https://zdravie-ľahko.sk", name: "Zdravie Ľahko Čšž" });
    const b = await createBrand(db, { url: "https://örnek.com.tr", name: "Örnek Sağlık ğış" });
    expect(a.brand.slug).toBe("zdravie-lahko-csz");
    expect(b.brand.slug).toMatch(/^ornek-sa/);
  });
});
