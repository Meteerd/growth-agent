import fs from "node:fs";
import path from "node:path";
import type { Blueprint, Brand, Evidence, Run, RunEvent } from "@/contracts";
import type { Db } from "../db/client";
import {
  appendEvent,
  getBrand,
  getRun,
  listBlueprints,
  listEvents,
  listEvidence,
  upsertBlueprint,
  upsertEvidence,
  upsertRun,
} from "../repo";
import { scrub } from "../smoke/record";

/** A recorded live research pass (real data, captured once, replayed for the demo). Media stays in data/. */
export interface RecordedRun {
  recordedAt: string;
  brand: Pick<Brand, "id" | "slug" | "name">;
  run: Run;
  evidence: Evidence[];
  blueprints: Blueprint[];
  events: RunEvent[];
  spend: Record<string, number>;
}

export const RECORDED_DIR = path.join(process.cwd(), "src/contracts/fixtures/live/runs");

export function loadRecorded(slug: string): RecordedRun | null {
  const f = path.join(RECORDED_DIR, `${slug}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as RecordedRun) : null;
}

export async function exportRecorded(db: Db, runId: string, spend: Record<string, number>): Promise<string> {
  const run = await getRun(db, runId);
  if (!run) throw new Error("run not found");
  const brand = (await getBrand(db, run.brandId))!;
  const rec: RecordedRun = {
    recordedAt: new Date().toISOString(),
    brand: { id: brand.id, slug: brand.slug, name: brand.name },
    run: { ...run, demo: false, dataset: "live_recorded", capturedAt: run.startedAt ?? run.createdAt },
    // only real data goes into a recorded live dataset
    evidence: (await listEvidence(db, runId)).filter((e) => !e.demo),
    blueprints: await listBlueprints(db, runId),
    events: await keptEvents(db, runId),
    spend,
  };
  // flag the local row too, so this machine treats it as the brand's recorded dataset
  await upsertRun(db, rec.run);
  fs.mkdirSync(RECORDED_DIR, { recursive: true });
  const f = path.join(RECORDED_DIR, `${brand.slug}.json`);
  fs.writeFileSync(f, `${JSON.stringify(scrub(rec), null, 1)}\n`);
  return f;
}

/** Seed: import the recorded run as its own run (`dataset: live_recorded`). Idempotent. */
export async function importRecorded(db: Db, rec: RecordedRun): Promise<boolean> {
  if (await getRun(db, rec.run.id)) return false;
  await upsertRun(db, rec.run);
  await upsertEvidence(db, rec.evidence);
  for (const b of rec.blueprints) await upsertBlueprint(db, b);
  const { runEvents } = await import("../db/schema");
  for (const e of rec.events) {
    await db
      .insert(runEvents)
      .values({
        runId: e.runId,
        seq: e.id,
        ts: e.ts,
        phase: e.phase,
        type: e.type,
        title: e.title,
        detail: e.detail ?? null,
        refId: e.refId ?? null,
        costUsd: e.costUsd ?? null,
        data: e.data === undefined ? null : e.data,
      })
      .onConflictDoNothing();
  }
  return true;
}

/**
 * Start a new run on top of a finished research pass: copies its evidence and blueprints (new ids, same data,
 * `demo` flags kept), replays the intake/research/reverse_engineer events, and marks those phases done, so the
 * new run goes straight to the consultation. This is how the recorded real data powers a live demo run.
 */
export async function reuseResearch(
  db: Db,
  fromRunId: string,
  toRunId: string,
): Promise<{ evidence: number; blueprints: number }> {
  const sfx = toRunId.slice(-6);
  const map = new Map<string, string>();
  const evidence = (await listEvidence(db, fromRunId)).map((e) => {
    const id = `${e.id}_${sfx}`;
    map.set(e.id, id);
    return { ...e, id, runId: toRunId };
  });
  await upsertEvidence(db, evidence);
  const bps = (await listBlueprints(db, fromRunId)).map((b) => ({
    ...b,
    id: `${b.id}_${sfx}`,
    runId: toRunId,
    evidenceId: map.get(b.evidenceId) ?? b.evidenceId,
  }));
  for (const b of bps) await upsertBlueprint(db, b);
  const src = await listEvents(db, fromRunId);
  for (const e of src) {
    if (e.type === "status" || e.type === "cost") continue;
    if (!["intake", "research", "reverse_engineer"].includes(e.phase)) continue;
    const refId = e.refId
      ? (map.get(e.refId) ?? bps.find((b) => b.id === `${e.refId}_${sfx}`)?.id ?? e.refId)
      : undefined;
    await appendEvent(db, {
      runId: toRunId,
      phase: e.phase,
      type: e.type,
      title: e.title,
      detail: e.detail,
      refId,
      data: e.data,
    });
  }
  await appendEvent(db, {
    runId: toRunId,
    phase: "reverse_engineer",
    type: "log",
    title: `Research reused from ${fromRunId} (captured ${(await getRun(db, fromRunId))?.startedAt ?? ""})`,
  });
  return { evidence: evidence.length, blueprints: bps.length };
}

/** Events of the run minus those about demo evidence (renumbered so SSE ids stay contiguous). */
async function keptEvents(db: Db, runId: string): Promise<RunEvent[]> {
  const demoIds = new Set((await listEvidence(db, runId)).filter((e) => e.demo).map((e) => e.id));
  return (await listEvents(db, runId))
    .filter(
      (e) =>
        !(e.type === "evidence" && e.refId && demoIds.has(e.refId)) &&
        !(e.type === "tool_result" && /\(demo data\)/.test(e.title)),
    )
    .map((e, i) => ({ ...e, id: i + 1 }));
}
