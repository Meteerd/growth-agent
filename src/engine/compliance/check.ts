import { z } from "zod";
import type { Brand, ComplianceCheck, ComplianceFinding, Concept } from "@/contracts";
import { loadPrompt, structured } from "../agent/claude";
import type { Db } from "../db/client";
import { newId } from "../ids";
import { getRulePack, patternHits, rulePackText } from "../rules";

const PAID = new Set(["meta_ads", "tiktok_ads", "google_ads"]);

export const Findings = z.object({
  findings: z.array(
    z.object({
      ruleId: z.string(),
      severity: z.enum(["info", "warn", "block"]),
      message: z.string(),
      excerpt: z.string().optional(),
    }),
  ),
});

/** Everything in a concept that can carry a claim. */
export function conceptText(
  c: Pick<Concept, "hook" | "caption" | "hashtags" | "cta" | "shots" | "title" | "angle"> & { body?: string },
): string {
  return [
    `Title: ${c.title}`,
    `Hook: ${c.hook}`,
    `Angle: ${c.angle}`,
    ...c.shots.map(
      (s) =>
        `Shot ${s.idx + 1}: image prompt: ${s.visualPrompt}${s.onScreenText ? ` | on screen: ${s.onScreenText}` : ""}${s.voiceover ? ` | voiceover: ${s.voiceover}` : ""}`,
    ),
    `Caption: ${c.caption}`,
    `Hashtags: ${c.hashtags.join(" ")}`,
    `CTA: ${c.cta}`,
    c.body ? `Body: ${c.body}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function statusOf(findings: ComplianceFinding[]): ComplianceCheck["status"] {
  if (findings.some((f) => f.severity === "block")) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "pass";
}

/**
 * Check text against a rule pack: deterministic patterns first (a block hit always fails), then Claude's judgment.
 * Unknown rule ids from the model are dropped; block severity on a warn-only rule is downgraded.
 */
export async function checkText(
  db: Db,
  o: {
    brand: Brand;
    text: string;
    paid?: boolean;
    runId?: string;
    targetType: ComplianceCheck["targetType"];
    targetId: string;
    attempt?: number;
  },
): Promise<ComplianceCheck> {
  const pack = getRulePack(o.brand.rulePack);
  const rules = new Map(pack.rules.map((r) => [r.id, r]));
  const hits: ComplianceFinding[] = patternHits(pack.id, o.text, { paid: o.paid }).map((h) => ({
    ruleId: h.ruleId,
    severity: h.severity,
    message: h.message,
    excerpt: h.excerpt,
  }));
  const r = await structured(
    { db, runId: o.runId, phase: "compliance" },
    {
      route: "compliance",
      system: loadPrompt("compliance", { rulePack: rulePackText(pack.id) }),
      user: `Placement: ${o.paid ? "paid ad" : "organic post"}\n\n${o.text}`,
      schema: Findings,
      note: `compliance: ${o.targetType} ${o.targetId}`,
      maxTokens: 6000,
      demo: () => ({ findings: [] }),
    },
  );
  const model = r.value.findings
    .filter((f) => rules.has(f.ruleId) || f.severity === "info")
    .map((f) => {
      const rule = rules.get(f.ruleId);
      if (rule?.paidOnly && !o.paid) return { ...f, severity: "info" as const };
      return rule && rule.severity === "warn" && f.severity === "block" ? { ...f, severity: "warn" as const } : f;
    });
  const findings = [
    ...hits,
    ...model.filter((m) => !hits.some((h) => h.ruleId === m.ruleId && h.severity === m.severity)),
  ];
  return {
    id: newId("cc"),
    targetType: o.targetType,
    targetId: o.targetId,
    rulePack: pack.id,
    status: statusOf(findings),
    findings,
    createdAt: new Date().toISOString(),
    attempt: o.attempt ?? 0,
  };
}

export function isPaid(channel: string): boolean {
  return PAID.has(channel);
}
