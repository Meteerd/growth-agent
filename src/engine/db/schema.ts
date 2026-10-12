import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  Asset,
  Blueprint,
  BrandDossier,
  ChannelPlan,
  ComplianceCheck,
  Concept,
  Evidence,
  PublishPack,
  Question,
  RenderVersion,
  Review,
} from "@/contracts";

/**
 * SQLite schema. Hot columns are real columns (filters, joins, ordering); nested entity bodies live in JSON
 * columns typed by the contracts. Column names are snake_case.
 */

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  vertical: text("vertical").notNull(),
  countries: text("countries", { mode: "json" }).$type<string[]>().notNull(),
  languages: text("languages", { mode: "json" }).$type<string[]>().notNull(),
  rulePack: text("rule_pack").notNull(),
  dossier: text("dossier", { mode: "json" }).$type<BrandDossier>().notNull(),
  demo: integer("demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    config: text("config", { mode: "json" }).$type<Record<string, string>>().notNull(),
    lastSyncAt: text("last_sync_at"),
    summary: text("summary"),
    error: text("error"),
  },
  (t) => [index("connections_brand_idx").on(t.brandId)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    phase: text("phase").notNull(),
    costUsd: real("cost_usd").notNull().default(0),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
    demo: integer("demo", { mode: "boolean" }).notNull().default(false),
    dataset: text("dataset"),
    capturedAt: text("captured_at"),
    manusTaskUrl: text("manus_task_url"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("runs_brand_idx").on(t.brandId)],
);

export const runEvents = sqliteTable(
  "run_events",
  {
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    ts: text("ts").notNull(),
    phase: text("phase").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    refId: text("ref_id"),
    costUsd: real("cost_usd"),
    data: text("data", { mode: "json" }),
  },
  (t) => [primaryKey({ columns: [t.runId, t.seq] })],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    runId: text("run_id").notNull(),
    source: text("source").notNull(),
    kind: text("kind").notNull(),
    body: text("body", { mode: "json" }).$type<Evidence>().notNull(),
    capturedAt: text("captured_at").notNull(),
  },
  (t) => [index("evidence_run_idx").on(t.runId), index("evidence_brand_idx").on(t.brandId)],
);

export const blueprints = sqliteTable(
  "blueprints",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    runId: text("run_id").notNull(),
    evidenceId: text("evidence_id").notNull(),
    body: text("body", { mode: "json" }).$type<Blueprint>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("blueprints_run_idx").on(t.runId)],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    ord: integer("ord").notNull(),
    body: text("body", { mode: "json" }).$type<Question>().notNull(),
  },
  (t) => [index("questions_run_idx").on(t.runId)],
);

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    body: text("body", { mode: "json" }).$type<ChannelPlan>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("plans_run_idx").on(t.runId)],
);

export const concepts = sqliteTable(
  "concepts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    brandId: text("brand_id").notNull(),
    status: text("status").notNull(),
    body: text("body", { mode: "json" }).$type<Concept>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("concepts_run_idx").on(t.runId)],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    conceptId: text("concept_id"),
    kind: text("kind").notNull(),
    body: text("body", { mode: "json" }).$type<Asset>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("assets_concept_idx").on(t.conceptId)],
);

export const complianceChecks = sqliteTable(
  "compliance_checks",
  {
    id: text("id").primaryKey(),
    targetId: text("target_id").notNull(),
    status: text("status").notNull(),
    body: text("body", { mode: "json" }).$type<ComplianceCheck>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("compliance_target_idx").on(t.targetId)],
);

/** A19: every render of a concept is a version (parent, plan, chosen). */
export const renderVersions = sqliteTable(
  "render_versions",
  {
    id: text("id").primaryKey(),
    conceptId: text("concept_id").notNull(),
    version: integer("version").notNull(),
    body: text("body", { mode: "json" }).$type<RenderVersion>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("render_versions_concept_idx").on(t.conceptId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    conceptId: text("concept_id").notNull(),
    round: integer("round").notNull(),
    body: text("body", { mode: "json" }).$type<Review>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("reviews_concept_idx").on(t.conceptId)],
);

export const packs = sqliteTable(
  "packs",
  {
    id: text("id").primaryKey(),
    conceptId: text("concept_id").notNull(),
    brandId: text("brand_id").notNull(),
    runId: text("run_id"),
    platform: text("platform").notNull(),
    status: text("status").notNull(),
    body: text("body", { mode: "json" }).$type<PublishPack>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("packs_brand_idx").on(t.brandId), index("packs_run_idx").on(t.runId)],
);

export const metricSnapshots = sqliteTable(
  "metric_snapshots",
  {
    id: text("id").primaryKey(),
    packId: text("pack_id").notNull(),
    capturedAt: text("captured_at").notNull(),
    views: real("views"),
    likes: real("likes"),
    comments: real("comments"),
    shares: real("shares"),
    saves: real("saves"),
    follows: real("follows"),
    source: text("source").notNull(),
  },
  (t) => [index("metrics_pack_idx").on(t.packId)],
);

export const learnings = sqliteTable("learnings", {
  id: text("id").primaryKey(),
  brandId: text("brand_id"),
  insight: text("insight").notNull(),
  evidence: text("evidence").notNull(),
  confidence: text("confidence").notNull(),
  createdAt: text("created_at").notNull(),
});

export const spendEntries = sqliteTable(
  "spend_entries",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    runId: text("run_id"),
    usd: real("usd").notNull(),
    units: text("units"),
    note: text("note").notNull(),
    ts: text("ts").notNull(),
  },
  (t) => [index("spend_provider_idx").on(t.provider)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("chat_run_idx").on(t.runId)],
);

/** Recorded provider responses keyed by request hash (replay in demo/test mode). */
export const providerCache = sqliteTable("provider_cache", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(),
  body: text("body", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
});
