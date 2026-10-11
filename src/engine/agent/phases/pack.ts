import type { Channel, Concept, PublishPack } from "@/contracts";
import { getAsset, listCompliance, listConcepts, upsertPack } from "../../repo";
import type { PhaseCtx } from "../context";

const CHECKLIST: Partial<Record<Channel, string[]>> = {
  tiktok: [
    "Turn on TikTok's AI-generated content label if any shot is AI-made",
    "Post when your audience is active (evenings local time)",
    "Pin a comment that routes to the CTA",
  ],
  instagram_reels: [
    "Add Instagram's AI info label if any shot is AI-made",
    "Share to Stories after posting",
    "Use the cover frame from this pack",
  ],
  youtube_shorts: ["Mark altered or synthetic content in YouTube Studio if any shot is AI-made", "Title as a question"],
  reddit: [
    "Read the subreddit rules in the sidebar before posting",
    "Disclose that you work on the product",
    "No link in the body unless the rules allow it",
    "Reply to every comment in the first hour",
  ],
  linkedin: ["Post from the founder's profile, not the company page", "Reply to every comment within 2 hours"],
  x: ["Post as a thread if longer than one post", "Reply to early replies"],
  meta_ads: ["Paid: confirm the ad account is allowed to run this category before spending anything"],
};

const BEST_HOUR: Partial<Record<Channel, number>> = {
  tiktok: 19,
  instagram_reels: 18,
  youtube_shorts: 17,
  linkedin: 9,
  x: 12,
  reddit: 15,
};

function nextSlot(ch: Channel, i: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1 + Math.floor(i / 2));
  d.setHours(BEST_HOUR[ch] ?? 18, 0, 0, 0);
  return d.toISOString();
}

export function packFor(
  c: Concept,
  i: number,
  extra: { videoAssetId?: string; imageAssetIds: string[]; warnings: string[] },
): PublishPack {
  return {
    id: `pack_${c.id.replace(/^concept_/, "")}`,
    conceptId: c.id,
    brandId: c.brandId,
    runId: c.runId,
    platform: c.channel,
    videoAssetId: extra.videoAssetId,
    imageAssetIds: extra.imageAssetIds,
    caption: c.format === "text_post" && c.body ? `${c.hook}\n\n${c.body}` : c.caption,
    hashtags: c.hashtags,
    firstComment: c.cta,
    postAt: nextSlot(c.channel, i),
    checklist: [
      `Compliance check passed (${c.compliance})`,
      ...extra.warnings.map((w) => `Check before posting: ${w}`),
      ...(CHECKLIST[c.channel] ?? []),
      "Nothing is posted automatically: you post it, then paste the post URL here (mark posted)",
    ],
    status: "ready",
    createdAt: new Date(Date.now() + i).toISOString(),
  };
}

export async function pack(ctx: PhaseCtx): Promise<void> {
  const concepts = (await listConcepts(ctx.db, ctx.run.id)).filter((c) => c.compliance !== "fail");
  for (const [i, c] of concepts.entries()) {
    const checks = await listCompliance(ctx.db, c.id);
    const warnings = (checks.at(-1)?.findings ?? [])
      .filter((f) => f.severity === "warn")
      .map((f) => `${f.ruleId}: ${f.message}`);
    const video = c.videoAssetId ? await getAsset(ctx.db, c.videoAssetId) : null;
    const imageAssetIds = c.shots.map((s) => s.keyframeAssetId).filter((x): x is string => !!x);
    const p = packFor(c, i, { videoAssetId: video?.id, imageAssetIds, warnings });
    await upsertPack(ctx.db, p);
    await ctx.emit("pack", `Pack ready: ${c.channel} · ${c.title}`, {
      refId: p.id,
      data: { conceptId: c.id, platform: p.platform, hasVideo: !!video },
    });
  }
}
