import type { PublishPack } from "@/contracts";
import type { Db } from "../db/client";
import { HttpError } from "../http";
import { callProvider } from "../providers/call";
import { landingPrompt, startLandingPage, websiteStatus } from "../providers/manus";
import { appendEvent, getBrand, getConcept, getPack, upsertPack } from "../repo";

/**
 * AS1: Manus builds a landing page that matches a pack's ad. We keep the Manus task link on the pack
 * (`landingUrl`). We never publish the site; the operator reviews and publishes it in Manus.
 */
export async function buildLanding(db: Db, packId: string): Promise<PublishPack> {
  const p = await getPack(db, packId);
  if (!p) throw new HttpError(404, "not_found", "Pack not found");
  const c = await getConcept(db, p.conceptId);
  const b = await getBrand(db, p.brandId);
  if (!c || !b) throw new HttpError(404, "not_found", "Concept or brand not found");
  if (c.compliance === "fail") throw new HttpError(409, "compliance_failed", "Concept failed compliance");
  const prompt = landingPrompt({
    brandName: b.name,
    url: b.url,
    oneLiner: b.dossier.oneLiner,
    offer: b.dossier.offers.map((o) => `${o.name}${o.price ? ` (${o.price})` : ""}`).join(", "),
    hook: c.hook,
    angle: c.angle,
    cta: c.cta,
    language: c.language,
    colors: b.dossier.visual.colors,
    claimsAllowed: b.dossier.claimsAllowed,
    claimsForbidden: b.dossier.claimsForbidden,
  });
  const out = await callProvider(db, {
    provider: "manus",
    note: `manus landing page: ${p.id}`,
    runId: p.runId,
    estimateUsd: 0,
    demo: () => null,
    live: async () => ({ result: await startLandingPage(prompt), usd: 0, units: "1 lite task (credits)" }),
  });
  if (!out.value)
    throw new HttpError(
      409,
      "manus_demo",
      "Manus is in demo mode: add manus to LIVE_PROVIDERS (or run the smoke with --live) to build a real landing page",
    );
  const next: PublishPack = { ...p, landingUrl: out.value.task_url ?? out.value.share_url };
  await upsertPack(db, next);
  if (p.runId)
    await appendEvent(db, {
      runId: p.runId,
      phase: "pack",
      type: "tool_call",
      title: "Manus is building the campaign landing page",
      detail: next.landingUrl,
      refId: p.id,
      data: { provider: "manus", taskId: out.value.task_id },
    });
  return next;
}

export async function landingStatus(db: Db, packId: string, taskId: string) {
  const p = await getPack(db, packId);
  if (!p) throw new HttpError(404, "not_found", "Pack not found");
  return websiteStatus(taskId);
}
