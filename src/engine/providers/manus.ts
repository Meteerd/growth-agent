import { z } from "zod";
import type { Evidence } from "@/contracts";
import { outputSchema } from "../agent/claude";
import { baseEvidence, demoFor, type SourceCtx, type SourceResult } from "../research/types";
import { saveFixture } from "../smoke/record";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

const API = "https://api.manus.ai/v2";
const headers = () => ({ "x-manus-api-key": process.env.MANUS_API_KEY ?? "", "content-type": "application/json" });

export interface ManusTask {
  task_id: string;
  task_url?: string;
  share_url?: string;
}

export interface ManusEvent {
  id: string;
  type: string;
  timestamp?: number;
  status_update?: {
    agent_status?: string;
    brief?: string;
    description?: string;
    status_detail?: { waiting_for_event_type?: string; waiting_description?: string };
  };
  assistant_message?: { content?: string };
  error_message?: { content?: string; error_type?: string };
  structured_output_result?: { success: boolean; value: unknown; error?: string | null };
}

/** Manus requires every property listed in `required`; optional fields become nullable. */
export function manusSchema(schema: z.ZodType): Record<string, unknown> {
  const fix = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(fix);
    if (!n || typeof n !== "object") return n;
    const o = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, fix(v)])) as Record<string, unknown>;
    if (o.type === "object" && o.properties) {
      const props = o.properties as Record<string, Record<string, unknown>>;
      const req = new Set((o.required as string[] | undefined) ?? []);
      for (const k of Object.keys(props)) {
        if (!req.has(k) && typeof props[k].type === "string") props[k] = { ...props[k], type: [props[k].type, "null"] };
      }
      o.required = Object.keys(props);
      o.additionalProperties = false;
    }
    return o;
  };
  return fix(outputSchema(schema)) as Record<string, unknown>;
}

export async function createTask(prompt: string, schema?: z.ZodType, signal?: AbortSignal): Promise<ManusTask> {
  const body: Record<string, unknown> = { message: { content: prompt }, agent_profile: "lite" };
  if (schema) body.structured_output_schema = manusSchema(schema);
  const res = await fetchRetry(`${API}/task.create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal,
    timeoutMs: 60_000,
  });
  const j = await okJson<ManusTask & { ok?: boolean }>(res, "manus task.create");
  if (!j.task_id) throw new Error("manus task.create returned no task_id");
  return j;
}

export async function listMessages(taskId: string, signal?: AbortSignal): Promise<ManusEvent[]> {
  const out: ManusEvent[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ task_id: taskId, order: "asc", limit: "200", ...(cursor ? { cursor } : {}) });
    const j = await okJson<{ messages: ManusEvent[]; has_more?: boolean; next_cursor?: string }>(
      await fetchRetry(`${API}/task.listMessages?${qs}`, { headers: headers(), signal, timeoutMs: 30_000 }),
      "manus task.listMessages",
    );
    out.push(...(j.messages ?? []));
    if (!j.has_more || !j.next_cursor) break;
    cursor = j.next_cursor;
  }
  return out;
}

export type ManusState =
  | { state: "running"; brief?: string }
  | { state: "waiting"; question?: string }
  | { state: "done"; value: unknown; success: boolean; error?: string | null }
  | { state: "error"; error: string };

/** Interpret a task's event log (pure; tested against a recorded log). */
export function taskState(events: ManusEvent[]): ManusState {
  const result = events.find((e) => e.type === "structured_output_result")?.structured_output_result;
  if (result) return { state: "done", value: result.value, success: result.success, error: result.error };
  const err = [...events].reverse().find((e) => e.type === "error_message");
  const statuses = events.filter((e) => e.type === "status_update").map((e) => e.status_update?.agent_status);
  const last = statuses.at(-1);
  if (last === "error") return { state: "error", error: err?.error_message?.content ?? "Manus task error" };
  if (last === "waiting") {
    // waiting on its own sub-agents (e.g. cascadeJobCall) is still running; only ask-user waits need us
    const st = [...events].reverse().find((e) => e.type === "status_update")?.status_update;
    const kind = st?.status_detail?.waiting_for_event_type ?? "";
    if (/AskUser|confirm/i.test(kind)) {
      const q = [...events].reverse().find((e) => e.type === "assistant_message")?.assistant_message?.content;
      return { state: "waiting", question: q };
    }
    return { state: "running", brief: st?.status_detail?.waiting_description ?? st?.brief };
  }
  if (last === "stopped") {
    const text = [...events].reverse().find((e) => e.type === "assistant_message")?.assistant_message?.content;
    return { state: "done", value: text ?? null, success: false, error: "stopped without structured output" };
  }
  const brief = [...events].reverse().find((e) => e.type === "status_update")?.status_update?.brief;
  return { state: "running", brief };
}

export async function waitForTask(
  taskId: string,
  o: { timeoutMs: number; intervalMs?: number; signal?: AbortSignal; onProgress?: (brief: string) => void },
) {
  const until = Date.now() + o.timeoutMs;
  let lastBrief = "";
  let events: ManusEvent[] = [];
  while (Date.now() < until) {
    events = await listMessages(taskId, o.signal);
    const s = taskState(events);
    if (s.state !== "running") return { s, events };
    if (s.brief && s.brief !== lastBrief) {
      lastBrief = s.brief;
      o.onProgress?.(s.brief);
    }
    await new Promise((r) => setTimeout(r, o.intervalMs ?? 10_000));
    if (o.signal?.aborted) throw new Error("aborted");
  }
  return { s: { state: "running" as const, brief: lastBrief }, events };
}

// ---------------------------------------------------------------- GTM landscape research

export const ManusLandscape = z.object({
  summary: z.string(),
  channels: z.array(z.object({ channel: z.string(), why: z.string(), evidence: z.string() })),
  competitors: z.array(z.object({ name: z.string(), url: z.string(), whatWorksForThem: z.string() })),
  communities: z.array(z.object({ name: z.string(), url: z.string(), selfPromotionRules: z.string() })),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});
export type ManusLandscape = z.infer<typeof ManusLandscape>;

export function landscapePrompt(
  brandName: string,
  url: string,
  oneLiner: string,
  countries: string[],
  languages: string[],
): string {
  return [
    `Map the go-to-market landscape for ${brandName} (${url}): ${oneLiner}`,
    `Markets: ${countries.join(", ") || "not specified"}. Languages: ${languages.join(", ") || "en"}.`,
    "Find: (1) which channels the buyers of this kind of product actually use to discover it in these markets, with evidence; (2) 5 to 8 direct competitors and what marketing works for them (longest-running ads, viral formats); (3) the communities (subreddits, forums, groups) where the problem is discussed, with their self-promotion rules; (4) your sources.",
    "Facts only, each with a source URL. If something is unknown, say so. Keep it concise. Do not ask me questions: decide sensibly and continue. Write everything in English.",
  ].join("\n");
}

export function landscapeToEvidence(ctx: SourceCtx, v: ManusLandscape, taskUrl?: string): Evidence[] {
  const items: Evidence[] = [];
  const main = baseEvidence(ctx, "manus_research", "research", `Manus: GTM landscape for ${ctx.brand.name}`);
  main.url = taskUrl;
  main.text = [v.summary, ...v.channels.map((c) => `${c.channel}: ${c.why} (${c.evidence})`)].join("\n").slice(0, 3000);
  main.tags = ["research", "landscape"];
  items.push(main);
  if (v.competitors.length) {
    const c = baseEvidence(
      ctx,
      "manus_research",
      "research",
      `Manus: ${v.competitors.length} competitors and what works for them`,
    );
    c.url = taskUrl;
    c.text = v.competitors
      .map((x) => `${x.name} (${x.url}): ${x.whatWorksForThem}`)
      .join("\n")
      .slice(0, 3000);
    c.tags = ["research", "competitors"];
    items.push(c);
  }
  if (v.communities.length) {
    const c = baseEvidence(ctx, "manus_research", "research", `Manus: communities where the problem is discussed`);
    c.url = taskUrl;
    c.text = v.communities
      .map((x) => `${x.name} (${x.url}): ${x.selfPromotionRules}`)
      .join("\n")
      .slice(0, 3000);
    c.tags = ["research", "communities"];
    items.push(c);
  }
  return items;
}

/** Start a Manus deep-research task (returns immediately with the task link); `finish` waits for the result. */
export async function startLandscape(ctx: SourceCtx): Promise<{ task: ManusTask | null; mode: "live" | "demo" }> {
  const out = await callProvider(ctx.db, {
    provider: "manus",
    note: `manus deep research: ${ctx.brand.slug}`,
    runId: ctx.runId,
    estimateUsd: 0,
    demo: () => null,
    live: async () => {
      const b = ctx.brand;
      // reuse an already running task (e.g. after a crashed pass) instead of spending credits on a new one
      const reuse = process.env.MANUS_TASK_ID;
      if (reuse)
        return { result: { task_id: reuse, task_url: `https://manus.im/app/${reuse}` }, usd: 0, units: "reused task" };
      const task = await createTask(
        landscapePrompt(b.name, b.url, b.dossier.oneLiner, b.countries, b.languages),
        ManusLandscape,
        ctx.signal,
      );
      return { result: task, usd: 0, units: "1 lite task (credits)" };
    },
  });
  return { task: out.value, mode: out.mode };
}

export async function finishLandscape(
  ctx: SourceCtx,
  task: ManusTask | null,
  o: { timeoutMs: number; onProgress?: (b: string) => void },
): Promise<SourceResult> {
  if (!task) return { source: "manus_research", items: demoFor(ctx, "manus_research"), mode: "demo", usd: 0 };
  const { s, events } = await waitForTask(task.task_id, {
    timeoutMs: o.timeoutMs,
    signal: ctx.signal,
    onProgress: o.onProgress,
  });
  saveFixture("manus", `${ctx.brand.slug}_landscape`, { task, events });
  if (s.state === "done" && s.success) {
    const v = ManusLandscape.safeParse(s.value);
    if (v.success)
      return {
        source: "manus_research",
        items: landscapeToEvidence(ctx, v.data, task.task_url),
        mode: "live",
        usd: 0,
        link: task.task_url,
      };
  }
  const e = baseEvidence(ctx, "manus_research", "research", `Manus deep research (${s.state})`);
  e.url = task.task_url;
  e.text =
    s.state === "done"
      ? String(s.value ?? "").slice(0, 3000)
      : s.state === "error"
        ? s.error
        : "Still running; open the task link for live progress.";
  e.tags = ["research", "manus"];
  return { source: "manus_research", items: [e], mode: "live", usd: 0, link: task.task_url, note: s.state };
}

// ---------------------------------------------------------------- campaign landing page (AS1)

export interface WebsiteStatus {
  website_id?: string;
  title?: string;
  publish_status?: "unpublished" | "publishing" | "published" | "failed";
  site_urls?: string[];
  visibility?: string;
}

export async function websiteStatus(taskId: string, signal?: AbortSignal): Promise<WebsiteStatus | null> {
  const res = await fetchRetry(`${API}/website.status?task_id=${encodeURIComponent(taskId)}`, {
    headers: headers(),
    signal,
    timeoutMs: 30_000,
    retries: 1,
  });
  if (res.status === 404) return null;
  return okJson<WebsiteStatus>(res, "manus website.status");
}

export function landingPrompt(o: {
  brandName: string;
  url: string;
  oneLiner: string;
  offer: string;
  hook: string;
  angle: string;
  cta: string;
  language: string;
  colors: string[];
  claimsAllowed: string[];
  claimsForbidden: string[];
}): string {
  return [
    `Build a single-page campaign landing page for ${o.brandName} (${o.url}) that matches this ad, so people who click the ad land on the same promise.`,
    `Ad hook: "${o.hook}". Angle: ${o.angle}. Call to action: ${o.cta} (link the button to ${o.url}).`,
    `What the brand is: ${o.oneLiner} Offer: ${o.offer || "see the site"}.`,
    `Language: ${o.language}. Brand colors: ${o.colors.join(", ")}. Mobile first, fast, clean, one clear CTA above the fold, a short how-it-works section, no fake testimonials, no invented numbers.`,
    `Claims you may use: ${o.claimsAllowed.join("; ") || "only what the site says"}. Never say: ${o.claimsForbidden.join("; ") || "anything not on the site"}.`,
    "Do NOT publish or deploy the site. Build it and leave it unpublished for the team to review.",
  ].join("\n");
}

/** Start a Manus task that builds the page. Returns the task link at once; the site appears inside that task. */
export async function startLandingPage(prompt: string, signal?: AbortSignal): Promise<ManusTask> {
  return createTask(prompt, undefined, signal);
}
