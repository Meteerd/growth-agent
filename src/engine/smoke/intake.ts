import { makeCtx } from "../agent/context";
import { intake } from "../agent/phases/intake";
import type { Db } from "../db/client";
import { scrape } from "../providers/firecrawl";
import { getBrand, listEvents, listSpend } from "../repo";
import { createRun, setStatus } from "../runs";
import { ensureSeeded } from "../seed";
import { saveFixture } from "./record";

export async function smokeFirecrawl(db: Db) {
  const { page, mode } = await scrape(db, "https://houndapp.xyz");
  return {
    mode,
    usd: mode === "live" ? 0.01 : 0,
    title: page.title,
    chars: page.markdown.length,
    branding: page.branding?.colors,
  };
}

/** Live intake for one seeded brand: crawl + Claude extraction, recorded to fixtures/live/intake/<slug>.json. */
export async function smokeIntake(db: Db, slug = "hound") {
  await ensureSeeded(db);
  const brand = await getBrand(db, slug);
  if (!brand) throw new Error(`brand ${slug} not found`);
  const run = await createRun(db, brand.id, "research_only");
  const base = await makeCtx(db, run.id, new AbortController().signal);
  await intake(base.forPhase("intake"));
  const after = await getBrand(db, brand.id);
  const events = await listEvents(db, run.id);
  const spend = await listSpend(db, run.id);
  const usd = spend.reduce((a, s) => a + s.usd, 0);
  const live = spend.some((s) => s.provider === "anthropic");
  await setStatus(db, run.id, "done", "Smoke test finished").catch(() => undefined);
  const file = saveFixture("intake", slug, { runId: run.id, dossier: after?.dossier, events, spend });
  return {
    mode: live ? ("live" as const) : ("demo" as const),
    usd,
    file,
    oneLiner: after?.dossier.oneLiner,
    gaps: after?.dossier.gaps,
  };
}
