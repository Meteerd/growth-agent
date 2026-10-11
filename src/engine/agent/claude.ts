import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import type { Phase } from "@/contracts";
import type { Db } from "../db/client";
import { callProvider } from "../providers/call";
import { claudeCost, claudeEstimate } from "../providers/prices";
import { appendEvent } from "../repo";

/**
 * The engine's only door to Claude. Every call: adaptive thinking (Opus 5.5 cannot disable it), explicit effort
 * per route, streaming, structured output validated with Zod, refusal handling, cost into the ledger.
 * Server-side refusal fallback is on (`fallbacks: "default"`), so a policy decline is re-run on a fallback model.
 */

export type Route = "chat" | "extraction" | "strategy" | "compliance" | "vision" | "production";
export const EFFORT: Record<Route, "low" | "medium" | "high"> = {
  chat: "low",
  extraction: "medium",
  vision: "medium",
  production: "high",
  strategy: "high",
  compliance: "high",
};

export const MODEL = () => process.env.ENGINE_MODEL || "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class ClaudeRefusal extends Error {
  constructor(public category: string | null | undefined) {
    super(`Claude declined this request${category ? ` (${category})` : ""}`);
  }
}
export class ClaudeTruncated extends Error {
  constructor() {
    super("Claude hit max_tokens before finishing");
  }
}

export type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];
/** Sends one request and returns the final message. Swappable for recorded responses in tests. */
export type ClaudeTransport = (params: StreamParams, onText?: (t: string) => void) => Promise<BetaMessage>;

let client: Anthropic | undefined;
export const liveClaudeTransport: ClaudeTransport = async (params, onText) => {
  client ??= new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 });
  const stream = client.beta.messages.stream(params);
  if (onText) stream.on("text", (t) => onText(t));
  return stream.finalMessage();
};

let transport: ClaudeTransport = liveClaudeTransport;
/** Tests: replay recorded responses. Pass undefined to restore the live transport. */
export function setClaudeTransport(t?: ClaudeTransport) {
  transport = t ?? liveClaudeTransport;
}

// ---------------------------------------------------------------- prompts

const PROMPT_DIR = path.join(process.cwd(), "src/engine/agent/prompts");
const promptCache = new Map<string, string>();

/** Load `prompts/<name>.md` and fill `{{var}}` placeholders. Stable text only: keep volatile data in the user turn. */
export function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  let text = promptCache.get(name);
  if (text === undefined) {
    text = fs.readFileSync(path.join(PROMPT_DIR, `${name}.md`), "utf8");
    promptCache.set(name, text);
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

// ---------------------------------------------------------------- helpers

export interface CallCtx {
  db: Db;
  runId?: string;
  phase?: Phase;
  /** tests: force live through the injected transport */
  mode?: "live" | "demo";
}

function textOf(msg: BetaMessage): string {
  return msg.content
    .filter((b): b is Extract<BetaMessage["content"][number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function checkStop(msg: BetaMessage) {
  if (msg.stop_reason === "refusal") throw new ClaudeRefusal(msg.stop_details?.category);
  if (msg.stop_reason === "max_tokens") throw new ClaudeTruncated();
}

/** JSON Schema for structured outputs: strict objects, no unsupported numeric/string constraints. */
export function outputSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  const strip = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(strip);
    if (!n || typeof n !== "object") return n;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n)) {
      if (
        [
          "$schema",
          "minimum",
          "maximum",
          "exclusiveMinimum",
          "exclusiveMaximum",
          "minLength",
          "maxLength",
          "pattern",
          "format",
          "minItems",
          "maxItems",
          "default",
        ].includes(k)
      )
        continue;
      o[k] = strip(v);
    }
    if (o.type === "object") o.additionalProperties = false;
    return o;
  };
  return strip(js) as Record<string, unknown>;
}

function parseJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Claude returned no JSON");
  }
}

async function logCost(ctx: CallCtx, usd: number, title: string, msg: BetaMessage) {
  if (!ctx.runId || !ctx.phase) return;
  await appendEvent(ctx.db, {
    runId: ctx.runId,
    phase: ctx.phase,
    type: "cost",
    title,
    costUsd: usd,
    data: {
      provider: "anthropic",
      model: msg.model,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    },
  });
}

// ---------------------------------------------------------------- structured call

export interface StructuredOpts<S extends z.ZodType> {
  route: Route;
  /** stable system prompt (cached) */
  system: string;
  /** user turn: text or content blocks (images for vision) */
  user: string | BetaContentBlockParam[];
  schema: S;
  /** ledger note, e.g. "research: deconstruct winners" */
  note: string;
  maxTokens?: number;
  /** deterministic demo output (labelled demo by the caller) */
  demo: () => z.infer<S> | Promise<z.infer<S>>;
  /** stream text tokens (chat) */
  onText?: (t: string) => void;
}

export interface StructuredResult<T> {
  value: T;
  mode: "live" | "demo";
  usd: number;
  usage?: BetaMessage["usage"];
}

function estimateInputTokens(system: string, user: string | BetaContentBlockParam[]): number {
  const userText = typeof user === "string" ? user : JSON.stringify(user.filter((b) => b.type === "text"));
  const images = typeof user === "string" ? 0 : user.filter((b) => b.type === "image").length;
  return Math.ceil((system.length + userText.length) / 3.2) + images * 1600;
}

/** One Claude call that must return JSON matching `schema`. Falls back to demo on cap or refusal (with a warning). */
export async function structured<S extends z.ZodType>(
  ctx: CallCtx,
  o: StructuredOpts<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const model = MODEL();
  const maxTokens = o.maxTokens ?? 16000;
  let usage: BetaMessage["usage"] | undefined;
  const warn = async (title: string, detail?: string) => {
    if (ctx.runId && ctx.phase)
      await appendEvent(ctx.db, { runId: ctx.runId, phase: ctx.phase, type: "warning", title, detail });
  };
  try {
    const out = await callProvider(ctx.db, {
      provider: "anthropic",
      note: o.note,
      runId: ctx.runId,
      mode: ctx.mode,
      estimateUsd: claudeEstimate(model, estimateInputTokens(o.system, o.user), Math.min(maxTokens, 8000)),
      onBudgetExceeded: (e) => warn("Claude budget cap reached: using demo output for this step", e.message),
      demo: o.demo,
      live: async () => {
        const msg = await transport(
          {
            model,
            max_tokens: maxTokens,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: EFFORT[o.route], format: { type: "json_schema", schema: outputSchema(o.schema) } },
            system: [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: o.user }],
          } as StreamParams,
          o.onText,
        );
        usage = msg.usage;
        const usd = claudeCost(msg.model || model, msg.usage);
        checkStop(msg);
        const parsed = o.schema.safeParse(parseJson(textOf(msg)));
        if (!parsed.success)
          throw new Error(
            `Claude output failed validation: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")} ${i.message}`)
              .join("; ")}`,
          );
        await logCost(ctx, usd, `Claude: ${o.note}`, msg);
        return {
          result: parsed.data as z.infer<S>,
          usd,
          units: `${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`,
        };
      },
    });
    return { ...out, usage };
  } catch (e) {
    if (e instanceof ClaudeRefusal || e instanceof ClaudeTruncated) {
      await warn(`${e.message}: using demo output for this step`);
      return { value: await o.demo(), mode: "demo", usd: 0 };
    }
    throw e;
  }
}

// ---------------------------------------------------------------- free text (chat)

export interface TextOpts {
  route: Route;
  system: string;
  messages: BetaMessageParam[];
  note: string;
  maxTokens?: number;
  onText?: (t: string) => void;
  demo: () => string;
}

/** Streaming free-text call (consultation chat). */
export async function text(ctx: CallCtx, o: TextOpts): Promise<StructuredResult<string>> {
  const model = MODEL();
  const maxTokens = o.maxTokens ?? 4000;
  const out = await callProvider(ctx.db, {
    provider: "anthropic",
    note: o.note,
    runId: ctx.runId,
    mode: ctx.mode,
    estimateUsd: claudeEstimate(
      model,
      Math.ceil((o.system.length + JSON.stringify(o.messages).length) / 3.2),
      maxTokens,
    ),
    demo: () => {
      const t = o.demo();
      o.onText?.(t);
      return t;
    },
    live: async () => {
      const msg = await transport(
        {
          model,
          max_tokens: maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: EFFORT[o.route] },
          system: [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }],
          messages: o.messages,
        } as StreamParams,
        o.onText,
      );
      const usd = claudeCost(msg.model || model, msg.usage);
      if (msg.stop_reason === "refusal") throw new ClaudeRefusal(msg.stop_details?.category);
      await logCost(ctx, usd, `Claude: ${o.note}`, msg);
      return { result: textOf(msg), usd };
    },
  });
  return out;
}

export type { BetaContentBlockParam, BetaMessage, BetaToolUnion };
