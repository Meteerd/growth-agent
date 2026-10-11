import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  type Asset,
  type Blueprint,
  type Brand,
  type BrandDossier,
  type BrandSummary,
  type ChannelPlan,
  type ComplianceCheck,
  type Concept,
  type Connection,
  type DemoRunBundle,
  type Evidence,
  type Learning,
  type MetricSnapshot,
  type PublishPack,
  type Question,
  type Review,
  type Run,
  type RunEvent,
  RunEvent as RunEventSchema,
  type SpendEntry,
} from "@/contracts";
import { bus, runChannel } from "./bus";
import type { Db } from "./db/client";
import * as t from "./db/schema";
import { nowIso } from "./ids";

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

// ---------------------------------------------------------------- brands

function rowToBrand(r: typeof t.brands.$inferSelect): Brand {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    url: r.url,
    vertical: r.vertical as Brand["vertical"],
    countries: r.countries,
    languages: r.languages,
    rulePack: r.rulePack,
    dossier: r.dossier,
    demo: r.demo,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function upsertBrand(db: Db, b: Brand): Promise<void> {
  await db
    .insert(t.brands)
    .values({ ...b })
    .onConflictDoUpdate({
      target: t.brands.id,
      set: {
        slug: b.slug,
        name: b.name,
        url: b.url,
        vertical: b.vertical,
        countries: b.countries,
        languages: b.languages,
        rulePack: b.rulePack,
        dossier: b.dossier,
        demo: b.demo,
        updatedAt: b.updatedAt,
      },
    });
}

export async function insertBrandIfMissing(db: Db, b: Brand): Promise<boolean> {
  const res = await db
    .insert(t.brands)
    .values({ ...b })
    .onConflictDoNothing();
  return res.rowsAffected > 0;
}

export async function getBrand(db: Db, idOrSlug: string): Promise<Brand | null> {
  const rows = await db
    .select()
    .from(t.brands)
    .where(sql`${t.brands.id} = ${idOrSlug} OR ${t.brands.slug} = ${idOrSlug}`)
    .limit(1);
  return rows[0] ? rowToBrand(rows[0]) : null;
}

export async function listBrands(db: Db): Promise<Brand[]> {
  const rows = await db.select().from(t.brands).orderBy(asc(t.brands.createdAt), asc(t.brands.name));
  return rows.map(rowToBrand);
}

export async function slugExists(db: Db, slug: string): Promise<boolean> {
  const rows = await db.select({ id: t.brands.id }).from(t.brands).where(eq(t.brands.slug, slug)).limit(1);
  return rows.length > 0;
}

export async function listBrandSummaries(db: Db): Promise<BrandSummary[]> {
  const brands = await listBrands(db);
  const runRows = await db.select().from(t.runs).orderBy(desc(t.runs.createdAt));
  const packRows = await db.select().from(t.packs);
  const snaps = await db.select().from(t.metricSnapshots).orderBy(asc(t.metricSnapshots.capturedAt));
  const latestViews = new Map<string, number>();
  for (const s of snaps) if (s.views != null) latestViews.set(s.packId, s.views);
  return brands.map((b) => {
    const brandRuns = runRows.filter((r) => r.brandId === b.id);
    const brandPacks = packRows.filter((p) => p.brandId === b.id);
    const last = brandRuns[0];
    return {
      ...b,
      counts: {
        runs: brandRuns.length,
        packsReady: brandPacks.filter((p) => p.status === "ready").length,
        packsPosted: brandPacks.filter((p) => p.status === "posted").length,
        totalViews: brandPacks.reduce((a, p) => a + (latestViews.get(p.id) ?? 0), 0),
      },
      ...(last
        ? {
            lastRun: clean({
              id: last.id,
              status: last.status as Run["status"],
              phase: last.phase as Run["phase"],
              startedAt: last.startedAt ?? undefined,
              finishedAt: last.finishedAt ?? undefined,
            }),
          }
        : {}),
    };
  });
}

/**
 * Merge a partial dossier. source = "operator" locks the touched fields (recorded in provenance);
 * any other source skips fields the operator already edited.
 */
export async function patchDossier(
  db: Db,
  brandId: string,
  patch: Partial<BrandDossier>,
  source: "operator" | "crawl" | "answer" | "agent",
  ref?: string,
): Promise<Brand | null> {
  const brand = await getBrand(db, brandId);
  if (!brand) return null;
  const at = nowIso();
  const prov = [...(brand.dossier.provenance ?? [])];
  const locked = new Set(prov.filter((p) => p.source === "operator").map((p) => p.field));
  const next: BrandDossier = { ...brand.dossier };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k === "provenance") continue;
    if (source !== "operator" && locked.has(k)) continue;
    (next as Record<string, unknown>)[k] = v;
    const i = prov.findIndex((p) => p.field === k);
    const entry = clean({ field: k, source, ref, at });
    if (i >= 0) prov[i] = entry;
    else prov.push(entry);
  }
  next.provenance = prov;
  await db.update(t.brands).set({ dossier: next, updatedAt: at }).where(eq(t.brands.id, brand.id));
  return { ...brand, dossier: next, updatedAt: at };
}

// ---------------------------------------------------------------- connections

export async function listConnections(db: Db, brandId: string): Promise<Connection[]> {
  const rows = await db.select().from(t.connections).where(eq(t.connections.brandId, brandId));
  return rows.map((r) =>
    clean({
      id: r.id,
      brandId: r.brandId,
      provider: r.provider as Connection["provider"],
      status: r.status as Connection["status"],
      config: r.config,
      lastSyncAt: r.lastSyncAt ?? undefined,
      summary: r.summary ?? undefined,
      error: r.error ?? undefined,
    }),
  );
}

export async function upsertConnection(db: Db, c: Connection): Promise<void> {
  const row = {
    id: c.id,
    brandId: c.brandId,
    provider: c.provider,
    status: c.status,
    config: c.config,
    lastSyncAt: c.lastSyncAt ?? null,
    summary: c.summary ?? null,
    error: c.error ?? null,
  };
  await db.insert(t.connections).values(row).onConflictDoUpdate({ target: t.connections.id, set: row });
}

// ---------------------------------------------------------------- runs

function rowToRun(r: typeof t.runs.$inferSelect): Run {
  return clean({
    id: r.id,
    brandId: r.brandId,
    kind: r.kind as Run["kind"],
    status: r.status as Run["status"],
    phase: r.phase as Run["phase"],
    costUsd: r.costUsd,
    startedAt: r.startedAt ?? undefined,
    finishedAt: r.finishedAt ?? undefined,
    error: r.error ?? undefined,
    demo: r.demo,
    dataset: (r.dataset ?? undefined) as Run["dataset"],
    capturedAt: r.capturedAt ?? undefined,
    manusTaskUrl: r.manusTaskUrl ?? undefined,
    createdAt: r.createdAt,
  });
}

export async function upsertRun(db: Db, r: Run): Promise<void> {
  const row = {
    id: r.id,
    brandId: r.brandId,
    kind: r.kind,
    status: r.status,
    phase: r.phase,
    costUsd: r.costUsd,
    startedAt: r.startedAt ?? null,
    finishedAt: r.finishedAt ?? null,
    error: r.error ?? null,
    demo: r.demo,
    dataset: r.dataset ?? null,
    capturedAt: r.capturedAt ?? null,
    manusTaskUrl: r.manusTaskUrl ?? null,
    createdAt: r.createdAt,
  };
  await db.insert(t.runs).values(row).onConflictDoUpdate({ target: t.runs.id, set: row });
}

export async function getRun(db: Db, id: string): Promise<Run | null> {
  const rows = await db.select().from(t.runs).where(eq(t.runs.id, id)).limit(1);
  return rows[0] ? rowToRun(rows[0]) : null;
}

export async function listRuns(db: Db, brandId: string): Promise<Run[]> {
  const rows = await db.select().from(t.runs).where(eq(t.runs.brandId, brandId)).orderBy(desc(t.runs.createdAt));
  return rows.map(rowToRun);
}

export async function listRunsByStatus(db: Db, statuses: Run["status"][]): Promise<Run[]> {
  const rows = await db.select().from(t.runs).where(inArray(t.runs.status, statuses));
  return rows.map(rowToRun);
}

export async function updateRun(db: Db, id: string, patch: Partial<Run>): Promise<Run | null> {
  const cur = await getRun(db, id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  await upsertRun(db, next);
  if (patch.status && patch.status !== cur.status) bus.emit(runChannel(id), { status: patch.status });
  return next;
}

export async function addRunCost(db: Db, id: string, usd: number): Promise<void> {
  if (!usd) return;
  await db
    .update(t.runs)
    .set({ costUsd: sql`${t.runs.costUsd} + ${usd}` })
    .where(eq(t.runs.id, id));
}

// ---------------------------------------------------------------- run events

const eventLocks = new Map<string, Promise<unknown>>();

/** Append a RunEvent with the next monotonic id for its run. Serialized per run inside the process. */
export function appendEvent(db: Db, e: Omit<RunEvent, "id" | "ts"> & { ts?: string }): Promise<RunEvent> {
  const prev = eventLocks.get(e.runId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => appendEventUnlocked(db, e));
  eventLocks.set(e.runId, next);
  void next
    .finally(() => {
      if (eventLocks.get(e.runId) === next) eventLocks.delete(e.runId);
    })
    .catch(() => undefined);
  return next;
}

async function appendEventUnlocked(db: Db, e: Omit<RunEvent, "id" | "ts"> & { ts?: string }): Promise<RunEvent> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const max = await db
      .select({ m: sql<number>`coalesce(max(${t.runEvents.seq}), 0)` })
      .from(t.runEvents)
      .where(eq(t.runEvents.runId, e.runId));
    const seq = Number(max[0]?.m ?? 0) + 1;
    const ev: RunEvent = clean({ ...e, id: seq, ts: e.ts ?? nowIso() });
    try {
      await db.insert(t.runEvents).values({
        runId: ev.runId,
        seq,
        ts: ev.ts,
        phase: ev.phase,
        type: ev.type,
        title: ev.title,
        detail: ev.detail ?? null,
        refId: ev.refId ?? null,
        costUsd: ev.costUsd ?? null,
        data: ev.data === undefined ? null : ev.data,
      });
      bus.emit(runChannel(ev.runId), ev);
      return ev;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("appendEvent: unreachable");
}

export async function listEvents(db: Db, runId: string, afterSeq = 0): Promise<RunEvent[]> {
  const rows = await db
    .select()
    .from(t.runEvents)
    .where(and(eq(t.runEvents.runId, runId), gt(t.runEvents.seq, afterSeq)))
    .orderBy(asc(t.runEvents.seq));
  return rows.map((r) =>
    RunEventSchema.parse(
      clean({
        id: r.seq,
        runId: r.runId,
        ts: r.ts,
        phase: r.phase,
        type: r.type,
        title: r.title,
        detail: r.detail ?? undefined,
        refId: r.refId ?? undefined,
        costUsd: r.costUsd ?? undefined,
        data: r.data ?? undefined,
      }),
    ),
  );
}

// ---------------------------------------------------------------- evidence, blueprints, questions, plans

export async function upsertEvidence(db: Db, items: Evidence[]): Promise<void> {
  for (const e of items) {
    const row = {
      id: e.id,
      brandId: e.brandId,
      runId: e.runId,
      source: e.source,
      kind: e.kind,
      body: e,
      capturedAt: e.capturedAt,
    };
    await db.insert(t.evidence).values(row).onConflictDoUpdate({ target: t.evidence.id, set: row });
  }
}

export async function listEvidence(
  db: Db,
  runId: string,
  f: { source?: string; kind?: string } = {},
): Promise<Evidence[]> {
  const conds = [eq(t.evidence.runId, runId)];
  if (f.source) conds.push(eq(t.evidence.source, f.source));
  if (f.kind) conds.push(eq(t.evidence.kind, f.kind));
  const rows = await db
    .select()
    .from(t.evidence)
    .where(and(...conds))
    .orderBy(asc(t.evidence.id));
  return rows.map((r) => r.body);
}

export async function getEvidence(db: Db, id: string): Promise<Evidence | null> {
  const rows = await db.select().from(t.evidence).where(eq(t.evidence.id, id)).limit(1);
  return rows[0]?.body ?? null;
}

export async function upsertBlueprint(db: Db, b: Blueprint): Promise<void> {
  const row = {
    id: b.id,
    brandId: b.brandId,
    runId: b.runId,
    evidenceId: b.evidenceId,
    body: b,
    createdAt: b.createdAt,
  };
  await db.insert(t.blueprints).values(row).onConflictDoUpdate({ target: t.blueprints.id, set: row });
}

export async function listBlueprints(db: Db, runId: string): Promise<Blueprint[]> {
  const rows = await db
    .select()
    .from(t.blueprints)
    .where(eq(t.blueprints.runId, runId))
    .orderBy(asc(t.blueprints.createdAt));
  return rows.map((r) => r.body);
}

export async function getBlueprint(db: Db, id: string): Promise<Blueprint | null> {
  const rows = await db.select().from(t.blueprints).where(eq(t.blueprints.id, id)).limit(1);
  return rows[0]?.body ?? null;
}

export async function upsertQuestion(db: Db, q: Question): Promise<void> {
  const row = { id: q.id, runId: q.runId, ord: q.order, body: q };
  await db.insert(t.questions).values(row).onConflictDoUpdate({ target: t.questions.id, set: row });
}

export async function listQuestions(db: Db, runId: string): Promise<Question[]> {
  const rows = await db.select().from(t.questions).where(eq(t.questions.runId, runId)).orderBy(asc(t.questions.ord));
  return rows.map((r) => r.body);
}

export async function insertPlan(db: Db, p: ChannelPlan): Promise<void> {
  const row = { id: p.id, runId: p.runId, brandId: p.brandId, version: p.version, body: p, createdAt: p.createdAt };
  await db.insert(t.plans).values(row).onConflictDoUpdate({ target: t.plans.id, set: row });
}

export async function getLatestPlan(db: Db, runId: string): Promise<ChannelPlan | null> {
  const rows = await db.select().from(t.plans).where(eq(t.plans.runId, runId)).orderBy(desc(t.plans.version)).limit(1);
  return rows[0]?.body ?? null;
}

// ---------------------------------------------------------------- concepts, assets, compliance, reviews

export async function upsertConcept(db: Db, c: Concept): Promise<void> {
  const row = { id: c.id, runId: c.runId, brandId: c.brandId, status: c.status, body: c, createdAt: c.createdAt };
  await db.insert(t.concepts).values(row).onConflictDoUpdate({ target: t.concepts.id, set: row });
}

export async function getConcept(db: Db, id: string): Promise<Concept | null> {
  const rows = await db.select().from(t.concepts).where(eq(t.concepts.id, id)).limit(1);
  return rows[0]?.body ?? null;
}

export async function listConcepts(db: Db, runId: string): Promise<Concept[]> {
  const rows = await db
    .select()
    .from(t.concepts)
    .where(eq(t.concepts.runId, runId))
    .orderBy(asc(t.concepts.createdAt), asc(t.concepts.id));
  return rows.map((r) => r.body);
}

export async function upsertAsset(db: Db, a: Asset): Promise<void> {
  const row = {
    id: a.id,
    brandId: a.brandId,
    conceptId: a.conceptId ?? null,
    kind: a.kind,
    body: a,
    createdAt: a.createdAt,
  };
  await db.insert(t.assets).values(row).onConflictDoUpdate({ target: t.assets.id, set: row });
}

export async function getAsset(db: Db, id: string): Promise<Asset | null> {
  const rows = await db.select().from(t.assets).where(eq(t.assets.id, id)).limit(1);
  return rows[0]?.body ?? null;
}

export async function listAssets(db: Db, conceptId: string): Promise<Asset[]> {
  const rows = await db
    .select()
    .from(t.assets)
    .where(eq(t.assets.conceptId, conceptId))
    .orderBy(asc(t.assets.createdAt));
  return rows.map((r) => r.body);
}

export async function insertCompliance(db: Db, c: ComplianceCheck): Promise<void> {
  const row = { id: c.id, targetId: c.targetId, status: c.status, body: c, createdAt: c.createdAt };
  await db.insert(t.complianceChecks).values(row).onConflictDoUpdate({ target: t.complianceChecks.id, set: row });
}

export async function listCompliance(db: Db, targetId: string): Promise<ComplianceCheck[]> {
  const rows = await db
    .select()
    .from(t.complianceChecks)
    .where(eq(t.complianceChecks.targetId, targetId))
    .orderBy(asc(t.complianceChecks.createdAt));
  return rows.map((r) => r.body);
}

export async function upsertReview(db: Db, r: Review): Promise<void> {
  const row = { id: r.id, conceptId: r.conceptId, round: r.round, body: r, createdAt: r.createdAt };
  await db.insert(t.reviews).values(row).onConflictDoUpdate({ target: t.reviews.id, set: row });
}

export async function listReviews(db: Db, conceptId: string): Promise<Review[]> {
  const rows = await db
    .select()
    .from(t.reviews)
    .where(eq(t.reviews.conceptId, conceptId))
    .orderBy(asc(t.reviews.round));
  return rows.map((r) => r.body);
}

// ---------------------------------------------------------------- packs, metrics, learnings

export async function upsertPack(db: Db, p: PublishPack): Promise<void> {
  const row = {
    id: p.id,
    conceptId: p.conceptId,
    brandId: p.brandId,
    runId: p.runId ?? null,
    platform: p.platform,
    status: p.status,
    body: p,
    createdAt: p.createdAt,
  };
  await db.insert(t.packs).values(row).onConflictDoUpdate({ target: t.packs.id, set: row });
}

export async function getPack(db: Db, id: string): Promise<PublishPack | null> {
  const rows = await db.select().from(t.packs).where(eq(t.packs.id, id)).limit(1);
  return rows[0]?.body ?? null;
}

export async function listPacksByRun(db: Db, runId: string): Promise<PublishPack[]> {
  const rows = await db
    .select()
    .from(t.packs)
    .where(eq(t.packs.runId, runId))
    .orderBy(asc(t.packs.createdAt), asc(t.packs.id));
  return rows.map((r) => r.body);
}

export async function listPacksByBrand(db: Db, brandId: string): Promise<PublishPack[]> {
  const rows = await db
    .select()
    .from(t.packs)
    .where(eq(t.packs.brandId, brandId))
    .orderBy(asc(t.packs.createdAt), asc(t.packs.id));
  return rows.map((r) => r.body);
}

export async function insertSnapshot(db: Db, s: MetricSnapshot): Promise<void> {
  await db.insert(t.metricSnapshots).values({
    id: s.id,
    packId: s.packId,
    capturedAt: s.capturedAt,
    views: s.views ?? null,
    likes: s.likes ?? null,
    comments: s.comments ?? null,
    shares: s.shares ?? null,
    saves: s.saves ?? null,
    follows: s.follows ?? null,
    source: s.source,
  });
}

export async function listSnapshots(db: Db, packIds: string[]): Promise<MetricSnapshot[]> {
  if (!packIds.length) return [];
  const rows = await db
    .select()
    .from(t.metricSnapshots)
    .where(inArray(t.metricSnapshots.packId, packIds))
    .orderBy(asc(t.metricSnapshots.capturedAt));
  return rows.map((r) =>
    clean({
      id: r.id,
      packId: r.packId,
      capturedAt: r.capturedAt,
      views: r.views ?? undefined,
      likes: r.likes ?? undefined,
      comments: r.comments ?? undefined,
      shares: r.shares ?? undefined,
      saves: r.saves ?? undefined,
      follows: r.follows ?? undefined,
      source: r.source as MetricSnapshot["source"],
    }),
  );
}

export async function insertLearning(db: Db, l: Learning): Promise<void> {
  await db
    .insert(t.learnings)
    .values({ ...l, brandId: l.brandId ?? null })
    .onConflictDoNothing();
}

export async function listLearnings(db: Db, brandId?: string): Promise<Learning[]> {
  const rows = await db
    .select()
    .from(t.learnings)
    .where(brandId ? sql`${t.learnings.brandId} = ${brandId} OR ${t.learnings.brandId} IS NULL` : undefined)
    .orderBy(desc(t.learnings.createdAt));
  return rows.map((r) => ({ ...r, confidence: r.confidence as Learning["confidence"] }));
}

// ---------------------------------------------------------------- spend

export async function insertSpend(db: Db, s: SpendEntry): Promise<void> {
  await db.insert(t.spendEntries).values({ ...s, runId: s.runId ?? null, units: s.units ?? null });
}

export async function listSpend(db: Db, runId?: string): Promise<SpendEntry[]> {
  const rows = await db
    .select()
    .from(t.spendEntries)
    .where(runId ? eq(t.spendEntries.runId, runId) : undefined)
    .orderBy(asc(t.spendEntries.ts));
  return rows.map((r) =>
    clean({
      id: r.id,
      provider: r.provider as SpendEntry["provider"],
      runId: r.runId ?? undefined,
      usd: r.usd,
      units: r.units ?? undefined,
      note: r.note,
      ts: r.ts,
    }),
  );
}

export async function spentByProvider(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ provider: t.spendEntries.provider, usd: sql<number>`sum(${t.spendEntries.usd})` })
    .from(t.spendEntries)
    .groupBy(t.spendEntries.provider);
  return Object.fromEntries(rows.map((r) => [r.provider, Number(r.usd)]));
}

// ---------------------------------------------------------------- chat

export async function insertChat(
  db: Db,
  m: { id: string; runId: string; role: "user" | "assistant"; content: string },
) {
  await db.insert(t.chatMessages).values({ ...m, createdAt: nowIso() });
}

export async function listChat(db: Db, runId: string) {
  return db.select().from(t.chatMessages).where(eq(t.chatMessages.runId, runId)).orderBy(asc(t.chatMessages.createdAt));
}

// ---------------------------------------------------------------- bundles

/** Write every row of a recorded/demo run bundle (idempotent). Events are written only if the run has none. */
export async function importBundle(db: Db, b: DemoRunBundle, opts: { withEvents?: boolean } = {}): Promise<void> {
  await insertBrandIfMissing(db, b.brand);
  for (const c of b.connections) {
    const existing = await db.select({ id: t.connections.id }).from(t.connections).where(eq(t.connections.id, c.id));
    if (!existing.length) await upsertConnection(db, c);
  }
  await upsertRun(db, b.run);
  await upsertEvidence(db, b.evidence);
  for (const x of b.blueprints) await upsertBlueprint(db, x);
  for (const x of b.questions) await upsertQuestion(db, x);
  await insertPlan(db, b.plan);
  for (const x of b.concepts) await upsertConcept(db, x);
  for (const x of b.compliance) await insertCompliance(db, x);
  for (const x of b.assets) await upsertAsset(db, x);
  for (const x of b.reviews) await upsertReview(db, x);
  for (const x of b.packs) await upsertPack(db, x);
  if (opts.withEvents !== false) {
    const has = await db
      .select({ s: t.runEvents.seq })
      .from(t.runEvents)
      .where(eq(t.runEvents.runId, b.run.id))
      .limit(1);
    if (!has.length) {
      for (const e of b.events) {
        await db.insert(t.runEvents).values({
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
        });
      }
    }
  }
}
