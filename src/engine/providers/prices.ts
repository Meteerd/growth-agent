/**
 * Price table used for estimates before a call and for actual cost after it.
 * Sources: claude-api skill (cached 2026-10-06) for Claude; docs/APIS.md for fal and Apify; the rest are
 * conservative estimates (marked) so caps trip early rather than late. Update docs/APIS.md when verified.
 */
export const PRICES = {
  anthropic: {
    // USD per 1M tokens
    "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
    "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
    "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  } as Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>,
  openai: {
    imagePerImage: 0.07, // estimate: high-quality 1024x1536 image
    ttsPerMinute: 0.015, // estimate
    transcribePerMinute: 0.006, // estimate
    visionPer1kTokens: 0.005, // estimate (second-opinion calls)
  },
  firecrawl: { perPage: 0.005 }, // estimate (credits)
  apify: { perItem: 0.005, perAdsItem: 0.00075 }, // ads: ~$0.75 per 1K (docs/APIS.md); other actors: estimate
  manus: { creditsPerTaskLite: 150 }, // estimate; cap is BUDGET_MANUS_CREDITS (credits, not USD)
  fal: { draftPerSecond: 0.05, finalPerSecond: 0.112, imagePerImage: 0.04 }, // final: Kling 3.0 Pro, audio off
  higgsfield: { perSecond: 0.2 }, // estimate (docs say pricier than fal)
  youtube: { perCall: 0 },
  spiral: { perCall: 0 }, // credits metered by Spiral; smoke + real pass only
} as const;

export function claudeCost(
  model: string,
  u: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): number {
  const p = PRICES.anthropic[model] ?? PRICES.anthropic["claude-opus-5-5"];
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/** Upper-bound estimate for a Claude call (reserved against the cap before the call). */
export function claudeEstimate(model: string, inputTokens: number, maxOutputTokens: number): number {
  const p = PRICES.anthropic[model] ?? PRICES.anthropic["claude-opus-5-5"];
  return (inputTokens * p.input + maxOutputTokens * p.output) / 1_000_000;
}

/** Render cost estimate for a concept: keyframes + image-to-video seconds + voiceover. */
export function renderEstimate(shots: { durationSec: number }[], tier: "draft" | "final", withVoice = true) {
  const seconds = shots.reduce((a, s) => a + s.durationSec, 0);
  const keyframes = shots.length * PRICES.openai.imagePerImage;
  const video = seconds * (tier === "final" ? PRICES.fal.finalPerSecond : PRICES.fal.draftPerSecond);
  const voice = withVoice ? (seconds / 60) * PRICES.openai.ttsPerMinute : 0;
  const total = Math.round((keyframes + video + voice) * 100) / 100;
  return {
    totalUsd: total,
    lines: [
      { provider: "openai", item: `${shots.length} keyframes`, usd: Math.round(keyframes * 100) / 100 },
      { provider: "fal", item: `${seconds}s image-to-video (${tier})`, usd: Math.round(video * 100) / 100 },
      { provider: "openai", item: "voiceover", usd: Math.round(voice * 1000) / 1000 },
    ],
  };
}
