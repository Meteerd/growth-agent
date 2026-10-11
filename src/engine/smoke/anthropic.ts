import { z } from "zod";
import { liveClaudeTransport, MODEL, setClaudeTransport, structured } from "../agent/claude";
import type { Db } from "../db/client";
import { saveFixture } from "./record";

export const SmokeSchema = z.object({
  ok: z.boolean(),
  hook: z.string(),
  why: z.string(),
});

/** One cheap structured call (effort low via the chat route). Records the full request/response. */
export async function smokeAnthropic(db: Db) {
  let recorded: unknown;
  setClaudeTransport(async (params, onText) => {
    const msg = await liveClaudeTransport(params, onText);
    recorded = { request: { ...params, system: "[stable system prompt]" }, response: msg };
    return msg;
  });
  try {
    const r = await structured(
      { db },
      {
        route: "chat",
        system: "You are a senior short-form video strategist. Answer in JSON only.",
        user: "Write one scroll-stopping first line (max 12 words) for a 15-second TikTok about a dog that cries when left alone. Set ok to true and explain in one sentence why it stops the scroll.",
        schema: SmokeSchema,
        note: "smoke: anthropic structured output",
        maxTokens: 2000,
        demo: () => ({ ok: false, hook: "demo", why: "demo" }),
      },
    );
    const file = saveFixture("anthropic", "smoke", {
      model: MODEL(),
      mode: r.mode,
      usd: r.usd,
      value: r.value,
      ...(recorded as object),
    });
    return { mode: r.mode, usd: r.usd, value: r.value, file };
  } finally {
    setClaudeTransport();
  }
}
