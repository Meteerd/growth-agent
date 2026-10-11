import { z } from "zod";
import { CONTRACTS_VERSION, MetricsRequest, PatchDossierRequest } from "@/contracts";
import type { Db } from "./db/client";
import {
  getBrand,
  getLatestPlan,
  listBrandSummaries,
  listEvidence,
  listLearnings,
  listRuns,
  patchDossier,
} from "./repo";
import { getRulePack, rulePackText } from "./rules";
import { addMetrics, markPosted } from "./services/packs";

/**
 * Minimal MCP server (Streamable HTTP, JSON responses): initialize, tools/list, tools/call, ping.
 * Lets any MCP client (Claude, Manus custom MCP) read and update the brand brain. Read-mostly; nothing is posted.
 */
type Tool = {
  name: string;
  description: string;
  input: z.ZodObject;
  run: (db: Db, a: Record<string, unknown>) => Promise<unknown>;
};

const brandArg = z.object({ brand: z.string().describe("brand id or slug, e.g. hound") });

async function brandOrThrow(db: Db, idOrSlug: string) {
  const b = await getBrand(db, idOrSlug);
  if (!b) throw new Error(`Unknown brand ${idOrSlug}`);
  return b;
}

async function latestRunId(db: Db, brandId: string, runId?: string) {
  if (runId) return runId;
  const runs = await listRuns(db, brandId);
  return runs.find((r) => r.status === "done")?.id ?? runs[0]?.id;
}

export const TOOLS: Tool[] = [
  {
    name: "list_brands",
    description: "All brands with counts (runs, packs ready/posted, total views) and their last run.",
    input: z.object({}),
    run: async (db) =>
      (await listBrandSummaries(db)).map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        url: b.url,
        vertical: b.vertical,
        counts: b.counts,
        lastRun: b.lastRun,
      })),
  },
  {
    name: "get_dossier",
    description:
      "A brand's dossier: positioning, offers, personas, voice, claims, visual identity, gaps, operator answers.",
    input: brandArg,
    run: async (db, a) => (await brandOrThrow(db, String(a.brand))).dossier,
  },
  {
    name: "update_dossier",
    description: "Operator edit of dossier fields (they become locked against later crawls).",
    input: brandArg.extend({ patch: z.record(z.string(), z.unknown()).describe("partial BrandDossier") }),
    run: async (db, a) => {
      const b = await brandOrThrow(db, String(a.brand));
      return (await patchDossier(db, b.id, PatchDossierRequest.parse(a.patch), "operator", "mcp"))?.dossier;
    },
  },
  {
    name: "get_rule_pack",
    description: "The brand's compliance rule pack (rule ids, severity, text).",
    input: brandArg,
    run: async (db, a) => {
      const b = await brandOrThrow(db, String(a.brand));
      return {
        id: b.rulePack,
        text: rulePackText(b.rulePack),
        rules: getRulePack(b.rulePack).rules.map(({ patterns: _p, ...r }) => r),
      };
    },
  },
  {
    name: "search_evidence",
    description:
      "Evidence from a brand's latest finished run (or a given run): ads, posts, videos, threads, reviews, research. Filter by source/kind/text.",
    input: brandArg.extend({
      runId: z.string().optional(),
      source: z.string().optional(),
      kind: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().optional(),
    }),
    run: async (db, a) => {
      const b = await brandOrThrow(db, String(a.brand));
      const runId = await latestRunId(db, b.id, a.runId as string | undefined);
      if (!runId) return [];
      const q = String(a.query ?? "").toLowerCase();
      const items = (
        await listEvidence(db, runId, { source: a.source as string | undefined, kind: a.kind as string | undefined })
      ).filter((e) => !q || `${e.title} ${e.text ?? ""} ${e.deconstruction?.hook ?? ""}`.toLowerCase().includes(q));
      return items
        .slice(0, Number(a.limit ?? 25))
        .map((e) => ({
          id: e.id,
          source: e.source,
          kind: e.kind,
          title: e.title,
          url: e.url,
          author: e.author,
          metrics: e.metrics,
          deconstruction: e.deconstruction,
          demo: e.demo,
        }));
    },
  },
  {
    name: "get_channel_plan",
    description:
      "The latest channel plan for a brand: ranked channels with scores, weights, rationale, evidence, and the not-now list.",
    input: brandArg.extend({ runId: z.string().optional() }),
    run: async (db, a) => {
      const b = await brandOrThrow(db, String(a.brand));
      for (const r of await listRuns(db, b.id)) {
        if (a.runId && r.id !== a.runId) continue;
        const p = await getLatestPlan(db, r.id);
        if (p) return p;
      }
      return null;
    },
  },
  {
    name: "log_results",
    description: "Record a post's real metrics (and optionally its URL) for a ready pack. Never invent numbers.",
    input: z.object({
      packId: z.string(),
      postedUrl: z.string().optional(),
      views: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      saves: z.number().optional(),
      follows: z.number().optional(),
    }),
    run: async (db, a) => {
      const { packId, postedUrl, ...m } = a as { packId: string; postedUrl?: string } & Record<string, number>;
      if (postedUrl) await markPosted(db, packId, { postedUrl });
      return addMetrics(db, packId, MetricsRequest.parse(m));
    },
  },
  {
    name: "get_learnings",
    description: "What worked for a brand (and cross-brand patterns), from real posted results only.",
    input: z.object({ brand: z.string().optional() }),
    run: async (db, a) => listLearnings(db, a.brand ? (await brandOrThrow(db, String(a.brand))).id : undefined),
  },
];

interface RpcReq {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const PROTOCOL = "2025-06-18";

export async function handleRpc(db: Db, req: RpcReq): Promise<object | null> {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: req.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: req.id ?? null, error: { code, message } });
  if (req.id === undefined) return null; // notification
  switch (req.method) {
    case "initialize":
      return ok({
        protocolVersion: String(req.params?.protocolVersion ?? PROTOCOL),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nexus-brand-brain", version: CONTRACTS_VERSION },
        instructions:
          "The multi-brand GTM brain: brands, dossiers, rule packs, evidence, channel plans, results and learnings. Nothing here posts or spends.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.input) })),
      });
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return err(-32602, `Unknown tool ${name}`);
      const args = tool.input.safeParse(req.params?.arguments ?? {});
      if (!args.success)
        return ok({
          isError: true,
          content: [{ type: "text", text: `Invalid arguments: ${args.error.issues.map((i) => i.message).join("; ")}` }],
        });
      try {
        const out = await tool.run(db, args.data as Record<string, unknown>);
        return ok({
          content: [{ type: "text", text: JSON.stringify(out, null, 1) }],
          structuredContent: Array.isArray(out) ? { items: out } : (out ?? {}),
        });
      } catch (e) {
        return ok({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
      }
    }
    default:
      return err(-32601, `Method not found: ${req.method}`);
  }
}
