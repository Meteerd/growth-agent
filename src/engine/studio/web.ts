import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { liveClaudeTransport, MODEL, noDashes, type StreamParams } from "../agent/claude";
import type { Db } from "../db/client";
import { callProvider } from "../providers/call";
import { claudeCost, claudeEstimate } from "../providers/prices";
import { wellFormed } from "../text";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
/** Web search is billed per search on top of tokens ($10 per 1,000). */
const PER_SEARCH = 0.01;

/**
 * Claude with the server-side web search tool: open research (competitors in a market, their Facebook page names,
 * what they advertise). Returns the final text with sources inline. Demo mode returns "" so callers fall back.
 */
export async function webResearch(
  db: Db,
  o: { system: string; prompt: string; note: string; maxSearches?: number; effort?: "low" | "medium" | "high" },
): Promise<{ text: string; usd: number; mode: "live" | "demo" }> {
  const model = MODEL();
  const maxUses = o.maxSearches ?? 8;
  const out = await callProvider(db, {
    provider: "anthropic",
    note: o.note,
    estimateUsd: claudeEstimate(model, 40000, 16000) + maxUses * PER_SEARCH,
    demo: () => "",
    live: async () => {
      const messages: BetaMessageParam[] = [{ role: "user", content: wellFormed(o.prompt) }];
      let usd = 0;
      let last: BetaMessage | undefined;
      for (let turn = 0; turn < 4; turn++) {
        last = await liveClaudeTransport({
          model,
          max_tokens: 32000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: o.effort ?? "medium" },
          system: [{ type: "text", text: o.system }],
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }],
          messages,
        } as StreamParams);
        usd += claudeCost(last.model || model, last.usage);
        const searches =
          (last.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ??
          0;
        usd += searches * PER_SEARCH;
        if (last.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: last.content });
      }
      if (last?.stop_reason === "refusal") throw new Error("Claude declined the research request");
      const text = (last?.content ?? [])
        .filter((b): b is Extract<BetaMessage["content"][number], { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { result: noDashes(text), usd, units: "web research" };
    },
  });
  return { text: out.value, usd: out.usd, mode: out.mode };
}
