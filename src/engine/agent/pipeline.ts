import type { Phase, RunKind } from "@/contracts";
import type { Db } from "../db/client";
import { startHeartbeat } from "../jobs/heartbeat";
import { listEvents, updateRun } from "../repo";
import { setStatus } from "../runs";
import { makeCtx, type PhaseCtx } from "./context";
import { PHASE_RUNNERS } from "./phases";

/** What a phase runner returns: "pause" stops the pipeline in waiting_input (the consult phase). */
export type PhaseResult = void | "pause";
export type PhaseRunner = (ctx: PhaseCtx) => Promise<PhaseResult>;

export const PHASE_TITLES: Record<Phase, [string, string]> = {
  intake: ["Reading the brand", "Dossier ready"],
  research: ["Gathering evidence", "Evidence gathered"],
  reverse_engineer: ["Watching the winners shot by shot", "Blueprints ready"],
  consult: ["Consultation: only what the data could not answer", "Dossier updated from answers"],
  direction: ["Deciding where to go", "Channel plan ready"],
  production: ["Writing concepts that remake proven structures", "Concepts ready"],
  review: ["Rendering and watching our own video", "Self-review done"],
  compliance: ["Final compliance gate", "Compliance gate passed"],
  pack: ["Building ready-to-post packs", "Packs ready"],
  measure: ["Reading results", "Learnings updated"],
};

export const PLAN_BY_KIND: Record<RunKind, Phase[]> = {
  full: [
    "intake",
    "research",
    "reverse_engineer",
    "consult",
    "direction",
    "production",
    "review",
    "compliance",
    "pack",
  ],
  research_only: ["intake", "research", "reverse_engineer"],
  production_only: ["production", "review", "compliance", "pack"],
};

export async function runPipeline(db: Db, runId: string, signal: AbortSignal): Promise<void> {
  const stop = startHeartbeat(runId);
  try {
    await runPhases(db, runId, signal);
  } finally {
    stop();
  }
}

async function runPhases(db: Db, runId: string, signal: AbortSignal): Promise<void> {
  const base = await makeCtx(db, runId, signal);
  const run = base.run;
  if (["done", "failed", "cancelled"].includes(run.status)) return;
  const done = new Set((await listEvents(db, runId)).filter((e) => e.type === "phase_completed").map((e) => e.phase));
  const plan = PLAN_BY_KIND[run.kind];
  await setStatus(db, runId, "running", run.status === "waiting_input" ? "Answers in, continuing" : "Run started");
  for (const phase of plan) {
    if (done.has(phase)) continue;
    base.check();
    const runner = PHASE_RUNNERS[phase];
    const ctx = base.forPhase(phase);
    await updateRun(db, runId, { phase });
    const started = (await listEvents(db, runId)).some((e) => e.type === "phase_started" && e.phase === phase);
    if (!started) await ctx.emit("phase_started", PHASE_TITLES[phase][0]);
    if (runner) {
      const r = await runner(ctx);
      if (r === "pause") {
        await setStatus(db, runId, "waiting_input");
        return;
      }
    }
    await ctx.emit("phase_completed", PHASE_TITLES[phase][1]);
  }
  await setStatus(db, runId, "done");
}
