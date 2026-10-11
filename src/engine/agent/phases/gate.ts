import { listCompliance, listConcepts } from "../../repo";
import type { PhaseCtx } from "../context";

/** Final gate before packs: every concept must have a passing (or warn) check on its final text. Fails are blocked. */
export async function complianceGate(ctx: PhaseCtx): Promise<void> {
  const concepts = await listConcepts(ctx.db, ctx.run.id);
  let blocked = 0;
  for (const c of concepts) {
    const checks = await listCompliance(ctx.db, c.id);
    const last = checks.at(-1);
    if (!last || c.compliance === "fail" || last.status === "fail") {
      blocked++;
      await ctx.emit("compliance", `BLOCKED: ${c.title}`, {
        refId: last?.id,
        detail: last
          ? `Still failing after ${c.revisions ?? 0} revisions: ${last.findings
              .filter((f) => f.severity === "block")
              .map((f) => `${f.ruleId} "${f.excerpt ?? ""}"`)
              .join(", ")}. It will not be exported; edit it by hand.`
          : "Never checked; not exported.",
        data: { targetId: c.id, status: "fail" },
      });
    }
  }
  await ctx.emit(
    "thinking",
    blocked
      ? `${concepts.length - blocked} of ${concepts.length} concepts cleared; ${blocked} blocked from export`
      : `All ${concepts.length} concepts cleared the ${ctx.brand.rulePack} rule pack`,
  );
}
