import { z } from "zod";
import type { Brand, ComplianceCheck, Concept } from "@/contracts";
import { loadPrompt, structured } from "../agent/claude";
import type { Db } from "../db/client";
import { insertCompliance } from "../repo";
import { rulePackText } from "../rules";
import { checkText, conceptText, isPaid } from "./check";

export const RevisedConcept = z.object({
  hook: z.string(),
  caption: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  body: z.string().optional(),
  shots: z.array(
    z.object({
      idx: z.number(),
      visualPrompt: z.string(),
      onScreenText: z.string().optional(),
      voiceover: z.string().optional(),
    }),
  ),
});

/** Deterministic scrub used in demo mode: removes the offending excerpts. */
export function scrub(c: Concept, check: ComplianceCheck): Concept {
  const bad = check.findings.filter((f) => f.severity === "block" && f.excerpt).map((f) => f.excerpt!.toLowerCase());
  const fix = (s?: string) => {
    if (!s) return s;
    let out = s;
    for (const b of bad) {
      const re = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out
        .replace(re, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.!?])/g, "$1");
    }
    return out.trim();
  };
  return {
    ...c,
    hook: fix(c.hook) ?? c.hook,
    caption: fix(c.caption) ?? c.caption,
    cta: fix(c.cta) ?? c.cta,
    body: fix(c.body),
    hashtags: c.hashtags.filter((h) => !bad.some((b) => h.toLowerCase().includes(b.replace(/\s/g, "")))),
    shots: c.shots.map((s) => ({
      ...s,
      visualPrompt: fix(s.visualPrompt) ?? s.visualPrompt,
      onScreenText: fix(s.onScreenText),
      voiceover: fix(s.voiceover),
    })),
  };
}

/**
 * Check a concept; on fail, revise and re-check (max 2 revisions). Every check is stored.
 * Returns the final concept (compliance = pass | warn | fail) and the checks.
 */
export async function checkAndRevise(
  db: Db,
  brand: Brand,
  concept: Concept,
  runId?: string,
): Promise<{ concept: Concept; checks: ComplianceCheck[] }> {
  const checks: ComplianceCheck[] = [];
  let c = concept;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const check = await checkText(db, {
      brand,
      text: conceptText(c),
      paid: isPaid(c.channel),
      runId,
      targetType: "concept",
      targetId: c.id,
      attempt,
    });
    await insertCompliance(db, check);
    checks.push(check);
    if (check.status !== "fail") return { concept: { ...c, compliance: check.status, revisions: attempt }, checks };
    if (attempt === 2) break;
    const r = await structured(
      { db, runId, phase: "compliance" },
      {
        route: "compliance",
        system: loadPrompt("revise", { rulePack: rulePackText(brand.rulePack) }),
        user: `FINDINGS\n${check.findings.map((f) => `${f.ruleId} [${f.severity}] ${f.message}${f.excerpt ? ` (excerpt: "${f.excerpt}")` : ""}`).join("\n")}\n\nPIECE\n${JSON.stringify({ hook: c.hook, caption: c.caption, cta: c.cta, hashtags: c.hashtags, body: c.body, shots: c.shots.map((s) => ({ idx: s.idx, visualPrompt: s.visualPrompt, onScreenText: s.onScreenText, voiceover: s.voiceover })) })}`,
        schema: RevisedConcept,
        note: `compliance: revise ${c.id}`,
        maxTokens: 8000,
        demo: () => {
          const s = scrub(c, check);
          return {
            hook: s.hook,
            caption: s.caption,
            cta: s.cta,
            hashtags: s.hashtags,
            body: s.body,
            shots: s.shots.map((x) => ({
              idx: x.idx,
              visualPrompt: x.visualPrompt,
              onScreenText: x.onScreenText,
              voiceover: x.voiceover,
            })),
          };
        },
      },
    );
    const v = r.value;
    c = {
      ...c,
      hook: v.hook,
      caption: v.caption,
      cta: v.cta,
      hashtags: v.hashtags,
      body: v.body ?? c.body,
      shots: c.shots.map((s) => {
        const n = v.shots.find((x) => x.idx === s.idx);
        return n ? { ...s, visualPrompt: n.visualPrompt, onScreenText: n.onScreenText, voiceover: n.voiceover } : s;
      }),
    };
  }
  return { concept: { ...c, compliance: "fail", revisions: 2 }, checks };
}
