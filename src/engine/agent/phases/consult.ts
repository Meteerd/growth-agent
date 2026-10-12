import { z } from "zod";
import { type Question, QuestionKind } from "@/contracts";
import type { Db } from "../../db/client";
import { HttpError } from "../../http";
import { nowIso } from "../../ids";
import {
  appendEvent,
  getBrand,
  getRun,
  listBlueprints,
  listEvidence,
  listQuestions,
  patchDossier,
  upsertQuestion,
} from "../../repo";
import { rulePackText } from "../../rules";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";
import { blueprintDigest, dossierDigest, evidenceDigest, keepIds, resolveCitations } from "../digest";

export const QuestionDrafts = z.object({
  questions: z.array(
    z.object({
      kind: QuestionKind,
      prompt: z.string(),
      why: z.string(),
      evidenceIds: z.array(z.string()),
      options: z.array(z.object({ id: z.string(), label: z.string(), hint: z.string().optional() })).optional(),
      scale: z.object({ min: z.number(), max: z.number(), minLabel: z.string(), maxLabel: z.string() }).optional(),
      defaultAnswer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
      required: z.boolean(),
      assumption: z.string(),
      fills: z.string(),
    }),
  ),
});

export function isSettled(q: Question): boolean {
  return q.answer !== undefined || q.skipped === true || !q.required;
}

/** Ask (once) the gap-driven questions; pause the run until every required one is answered or skipped. */
export async function consult(ctx: PhaseCtx): Promise<void | "pause"> {
  const { db, run, brand } = ctx;
  let qs = await listQuestions(db, run.id);
  if (!qs.length) {
    const evidence = await listEvidence(db, run.id);
    const ids = new Set(evidence.map((e) => e.id));
    const out = await structured(
      { db, runId: run.id, phase: "consult" },
      {
        route: "strategy",
        system: loadPrompt("consult", { rulePack: rulePackText(brand.rulePack) }),
        user: `DOSSIER\n${dossierDigest(brand)}\n\nEVIDENCE (id, source, metrics, hook)\n${evidenceDigest(evidence)}\n\nBLUEPRINTS OF WINNERS\n${blueprintDigest(await listBlueprints(db, run.id)) || "(none)"}`,
        schema: QuestionDrafts,
        note: `consult: questions for ${brand.slug}`,
        maxTokens: 12000,
        demo: () => ({
          questions: (ctx.demo?.questions ?? []).map((q) => ({
            kind: q.kind,
            prompt: q.prompt,
            why: q.why,
            evidenceIds: q.evidenceIds,
            options: q.options,
            scale: q.scale,
            defaultAnswer: q.defaultAnswer as string | undefined,
            required: q.required,
            assumption: "We will use the suggested default.",
            fills: q.fills ?? "notes",
          })),
        }),
      },
    );
    let drafts = out.value.questions.slice(0, 9);
    if (!drafts.length) drafts = genericQuestions();
    qs = drafts.map((d, i) => ({
      id: `q_${run.id.slice(-8)}_${i + 1}`,
      runId: run.id,
      order: i + 1,
      kind: d.kind,
      prompt: d.prompt,
      why: resolveCitations(d.why, ids),
      evidenceIds: keepIds(d.evidenceIds, ids),
      options: d.options,
      scale: d.scale,
      defaultAnswer: d.defaultAnswer,
      // every question needs an answer or an explicit skip, otherwise the run would never stop to consult
      required: true,
      assumption: d.assumption,
      fills: d.fills,
    }));
    for (const q of qs) {
      await upsertQuestion(db, q);
      await ctx.emit("question", q.prompt, {
        refId: q.id,
        detail: q.why,
        data: { kind: q.kind, evidenceIds: q.evidenceIds },
      });
    }
  }
  if (qs.every(isSettled)) {
    await ctx.emit(
      "thinking",
      `Answers in: ${qs.filter((q) => q.answer !== undefined).length} answered, ${qs.filter((q) => q.skipped).length} skipped with stated assumptions`,
    );
    return;
  }
  return "pause";
}

function genericQuestions(): z.infer<typeof QuestionDrafts>["questions"] {
  return [
    {
      kind: "single",
      prompt: "What is the one goal for the next 30 days?",
      why: "Every channel score depends on it.",
      evidenceIds: [],
      options: [
        { id: "signups", label: "Sign-ups or leads" },
        { id: "revenue", label: "Revenue" },
        { id: "audience", label: "Audience" },
      ],
      defaultAnswer: "signups",
      required: true,
      assumption: "Sign-ups",
      fills: "goals",
    },
    {
      kind: "scale",
      prompt: "How much can we spend on paid tests this month (USD)?",
      why: "Zero is valid: the plan then stays organic.",
      evidenceIds: [],
      scale: { min: 0, max: 2000, minLabel: "$0", maxLabel: "$2,000" },
      defaultAnswer: 0,
      required: true,
      assumption: "$0, organic only",
      fills: "budget.paidUsd",
    },
    {
      kind: "confirm",
      prompt: "Can someone from the team appear on camera?",
      why: "Talking-head formats need a face; without one we use faceless formats.",
      evidenceIds: [],
      defaultAnswer: false,
      required: true,
      assumption: "No one on camera",
      fills: "assets.onCamera",
    },
  ];
}

function answerText(q: Question, value: unknown): string {
  const label = (id: unknown) => q.options?.find((o) => o.id === id)?.label ?? String(id);
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return q.options ? label(value) : String(value);
}

/**
 * Record answers (or skips), write them into the dossier with provenance, and report whether the run can resume.
 * Late or duplicate answers to an already answered question overwrite it (latest wins).
 */
export async function submitAnswers(
  db: Db,
  runId: string,
  answers: { questionId: string; value?: unknown; skip?: boolean }[],
): Promise<{ questions: Question[]; ready: boolean }> {
  const run = await getRun(db, runId);
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  if (["done", "failed", "cancelled"].includes(run.status))
    throw new HttpError(409, "run_finished", `Run is ${run.status}`);
  const qs = await listQuestions(db, runId);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const at = nowIso();
  const notes: { questionId: string; prompt: string; answer: string; at: string }[] = [];
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) throw new HttpError(400, "unknown_question", `Unknown question ${a.questionId}`);
    if (!a.skip && a.value === undefined) throw new HttpError(400, "missing_value", `No value for ${a.questionId}`);
    const next: Question = a.skip
      ? { ...q, skipped: true, answer: undefined, answeredAt: at }
      : { ...q, answer: a.value, skipped: false, answeredAt: at };
    byId.set(q.id, next);
    await upsertQuestion(db, next);
    notes.push({
      questionId: q.id,
      prompt: q.prompt,
      answer: a.skip ? `Skipped. Assumption: ${q.assumption ?? "default"}` : answerText(q, a.value),
      at,
    });
    await appendEvent(db, {
      runId,
      phase: "consult",
      type: "log",
      title: a.skip ? `Skipped: ${q.prompt}` : `Answer recorded: ${q.prompt}`,
      refId: q.id,
      detail: notes.at(-1)?.answer,
      data: { answer: a.skip ? null : a.value, skipped: !!a.skip },
    });
  }
  const brand = await getBrand(db, run.brandId);
  if (brand && notes.length) {
    const kept = (brand.dossier.operatorNotes ?? []).filter((n) => !notes.some((x) => x.questionId === n.questionId));
    await patchDossier(db, brand.id, { operatorNotes: [...kept, ...notes] }, "answer", runId);
  }
  const all = [...byId.values()].sort((a, b) => a.order - b.order);
  return { questions: all, ready: all.every(isSettled) };
}
