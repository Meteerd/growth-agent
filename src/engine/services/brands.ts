import type { Brand, CreateBrandRequest, Run, Vertical } from "@/contracts";
import type { Db } from "../db/client";
import { HttpError } from "../http";
import { newId, nowIso, slugify } from "../ids";
import { slugExists, upsertBrand, upsertRun } from "../repo";

const RULE_PACK_BY_VERTICAL: Record<Vertical, string> = {
  telehealth_rx: "eu_rx_telehealth",
  consumer_app: "common",
  health_wellness_dtc: "common",
  b2b_saas: "common",
  other: "common",
};

export function normalizeUrl(input: string): URL {
  const raw = input.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!u.hostname.includes(".")) throw new Error("no tld");
    return u;
  } catch {
    throw new HttpError(400, "invalid_url", `Not a valid website URL: ${input}`);
  }
}

function nameFromHost(host: string): string {
  const base = host.replace(/^www\./, "").split(".")[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Creates a brand with an empty dossier and a queued full run that starts with intake. */
export async function createBrand(db: Db, req: CreateBrandRequest): Promise<{ brand: Brand; run: Run }> {
  const url = normalizeUrl(req.url);
  const name = req.name?.trim() || nameFromHost(url.hostname);
  let slug = slugify(name);
  for (let i = 2; await slugExists(db, slug); i++) slug = `${slugify(name)}-${i}`;
  const now = nowIso();
  const vertical = req.vertical ?? "other";
  const brand: Brand = {
    id: newId("brand"),
    slug,
    name,
    url: url.origin,
    vertical,
    countries: req.countries ?? [],
    languages: req.languages ?? [],
    rulePack: RULE_PACK_BY_VERTICAL[vertical],
    demo: false,
    createdAt: now,
    updatedAt: now,
    dossier: {
      oneLiner: "",
      positioning: "",
      offers: [],
      personas: [],
      voice: { tone: "", do: [], dont: [] },
      proof: [],
      claimsAllowed: [],
      claimsForbidden: [],
      visual: { colors: [] },
      competitors: [],
      gaps: ["Everything: intake has not run yet"],
      sources: [],
    },
  };
  await upsertBrand(db, brand);
  const run: Run = {
    id: newId("run"),
    brandId: brand.id,
    kind: "full",
    status: "queued",
    phase: "intake",
    costUsd: 0,
    demo: false,
    createdAt: now,
  };
  await upsertRun(db, run);
  return { brand, run };
}
