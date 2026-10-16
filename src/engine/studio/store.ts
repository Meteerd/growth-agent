import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { adRefs, ads, studioJobs, studioKv, studioMessages } from "../db/schema";
import { newId, nowIso } from "../ids";
import type { Ad, AdBody, AdRef, AdRefBody, AdStatus, Job, JobKind, JobStatus } from "./types";

// ---------------------------------------------------------------- kv

export async function kvGet<T>(db: Db, key: string): Promise<T | null> {
  const r = await db.select().from(studioKv).where(eq(studioKv.key, key)).limit(1);
  return (r[0]?.value as T | undefined) ?? null;
}

export async function kvSet(db: Db, key: string, value: unknown): Promise<void> {
  const updatedAt = nowIso();
  await db
    .insert(studioKv)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: studioKv.key, set: { value, updatedAt } });
}

// ---------------------------------------------------------------- jobs

const toJob = (r: typeof studioJobs.$inferSelect): Job => ({
  ...r,
  kind: r.kind as JobKind,
  status: r.status as JobStatus,
  output: r.output ?? null,
});

export async function createJob(
  db: Db,
  o: { brandId: string | null; kind: JobKind; input: Record<string, unknown> },
): Promise<Job> {
  const now = nowIso();
  const row = {
    id: newId("job"),
    brandId: o.brandId,
    kind: o.kind,
    status: "queued" as const,
    step: null,
    progress: 0,
    input: o.input,
    output: null,
    log: [],
    error: null,
    costUsd: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(studioJobs).values(row);
  return row;
}

export async function getJob(db: Db, id: string): Promise<Job | null> {
  const r = await db.select().from(studioJobs).where(eq(studioJobs.id, id)).limit(1);
  return r[0] ? toJob(r[0]) : null;
}

export async function listJobs(db: Db, o: { brandId?: string; limit?: number } = {}): Promise<Job[]> {
  const q = db.select().from(studioJobs);
  const rows = await (o.brandId ? q.where(eq(studioJobs.brandId, o.brandId)) : q)
    .orderBy(desc(studioJobs.createdAt))
    .limit(o.limit ?? 50);
  return rows.map(toJob);
}

export async function listJobsByStatus(db: Db, statuses: JobStatus[]): Promise<Job[]> {
  const rows = await db.select().from(studioJobs).where(inArray(studioJobs.status, statuses));
  return rows.map(toJob);
}

export async function updateJob(
  db: Db,
  id: string,
  patch: Partial<Pick<Job, "status" | "step" | "progress" | "output" | "error">> & { addCost?: number; log?: string },
): Promise<void> {
  const cur = await getJob(db, id);
  if (!cur) return;
  const log = patch.log ? [...cur.log, { ts: nowIso(), msg: patch.log }].slice(-200) : cur.log;
  await db
    .update(studioJobs)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.step !== undefined ? { step: patch.step } : {}),
      ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
      ...(patch.output !== undefined ? { output: patch.output } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      costUsd: cur.costUsd + (patch.addCost ?? 0),
      log,
      updatedAt: nowIso(),
    })
    .where(eq(studioJobs.id, id));
}

// ---------------------------------------------------------------- competitor refs

const toRef = (r: typeof adRefs.$inferSelect): AdRef => ({
  ...r,
  mediaType: r.mediaType as AdRef["mediaType"],
  body: r.body as unknown as AdRefBody,
});

export async function upsertRef(db: Db, ref: Omit<AdRef, "id" | "createdAt"> & { id?: string }): Promise<AdRef> {
  const existing = await db
    .select()
    .from(adRefs)
    .where(and(eq(adRefs.brandId, ref.brandId), eq(adRefs.source, ref.source), eq(adRefs.externalId, ref.externalId)))
    .limit(1);
  if (existing[0]) {
    const prev = toRef(existing[0]);
    // keep an earlier analysis when the scrape is refreshed
    const body = { ...ref.body, analysis: ref.body.analysis ?? prev.body.analysis };
    await db
      .update(adRefs)
      .set({ score: ref.score, body: body as unknown as Record<string, unknown>, advertiser: ref.advertiser })
      .where(eq(adRefs.id, prev.id));
    return { ...prev, score: ref.score, body };
  }
  const row = { ...ref, id: ref.id ?? newId("ref"), createdAt: nowIso() };
  await db.insert(adRefs).values({ ...row, body: row.body as unknown as Record<string, unknown> });
  return row;
}

export async function setRefAnalysis(db: Db, id: string, body: AdRefBody, score: number): Promise<void> {
  await db
    .update(adRefs)
    .set({ body: body as unknown as Record<string, unknown>, score })
    .where(eq(adRefs.id, id));
}

export async function listRefs(db: Db, brandId: string): Promise<AdRef[]> {
  const rows = await db.select().from(adRefs).where(eq(adRefs.brandId, brandId)).orderBy(desc(adRefs.score));
  return rows.map(toRef);
}

export async function getRef(db: Db, id: string): Promise<AdRef | null> {
  const r = await db.select().from(adRefs).where(eq(adRefs.id, id)).limit(1);
  return r[0] ? toRef(r[0]) : null;
}

export async function deleteRef(db: Db, id: string): Promise<void> {
  await db.delete(adRefs).where(eq(adRefs.id, id));
}

// ---------------------------------------------------------------- ads

const toAd = (r: typeof ads.$inferSelect): Ad => ({
  ...r,
  kind: r.kind as Ad["kind"],
  status: r.status as AdStatus,
  body: r.body as unknown as AdBody,
});

export async function insertAd(db: Db, ad: Omit<Ad, "createdAt" | "updatedAt">): Promise<Ad> {
  const now = nowIso();
  const row = { ...ad, createdAt: now, updatedAt: now };
  await db.insert(ads).values({ ...row, body: row.body as unknown as Record<string, unknown> });
  return row;
}

export async function updateAd(
  db: Db,
  id: string,
  patch: Partial<Pick<Ad, "status" | "score" | "body" | "format" | "kind">>,
): Promise<void> {
  const { body, ...rest } = patch;
  await db
    .update(ads)
    .set({
      ...rest,
      ...(body ? { body: body as unknown as Record<string, unknown> } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(ads.id, id));
}

export async function getAd(db: Db, id: string): Promise<Ad | null> {
  const r = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
  return r[0] ? toAd(r[0]) : null;
}

export async function listAds(
  db: Db,
  o: { brandId?: string; batchId?: string; status?: AdStatus } = {},
): Promise<Ad[]> {
  const conds = [
    o.brandId ? eq(ads.brandId, o.brandId) : undefined,
    o.batchId ? eq(ads.batchId, o.batchId) : undefined,
    o.status ? eq(ads.status, o.status) : undefined,
  ].filter((x) => x !== undefined);
  const rows = await db
    .select()
    .from(ads)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(ads.createdAt));
  return rows.map(toAd);
}

// ---------------------------------------------------------------- chat

export async function appendMessage(db: Db, threadId: string, role: "user" | "assistant", content: unknown) {
  const last = await db
    .select({ seq: studioMessages.seq })
    .from(studioMessages)
    .where(eq(studioMessages.threadId, threadId))
    .orderBy(desc(studioMessages.seq))
    .limit(1);
  const seq = (last[0]?.seq ?? 0) + 1;
  await db.insert(studioMessages).values({ id: newId("sm"), threadId, seq, role, content, createdAt: nowIso() });
}

export async function listMessages(db: Db, threadId: string) {
  return db.select().from(studioMessages).where(eq(studioMessages.threadId, threadId)).orderBy(asc(studioMessages.seq));
}

export async function clearThread(db: Db, threadId: string) {
  await db.delete(studioMessages).where(eq(studioMessages.threadId, threadId));
}
