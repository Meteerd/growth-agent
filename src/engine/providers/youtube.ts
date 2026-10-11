import type { Evidence } from "@/contracts";
import { baseEvidence, demoFor, num, type SourceCtx, type SourceResult } from "../research/types";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

const API = "https://www.googleapis.com/youtube/v3";

interface SearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    channelId: string;
    description: string;
    thumbnails?: { high?: { url: string } };
    publishedAt: string;
  };
}

function isoDurationSec(d?: string): number | undefined {
  const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** YouTube Shorts search (free; quota only). Outlier fallback = views / subscribers. */
export async function youtubeShorts(ctx: SourceCtx, queries: string[], lang?: string): Promise<SourceResult> {
  const out = await callProvider(ctx.db, {
    provider: "youtube",
    note: `shorts search: ${queries.join(" | ")}`,
    runId: ctx.runId,
    estimateUsd: 0,
    demo: () => demoFor(ctx, "youtube"),
    live: async () => {
      const key = process.env.YOUTUBE_API_KEY!;
      const per = Math.max(3, Math.ceil(ctx.limit / Math.max(1, queries.length)));
      const ids: SearchItem[] = [];
      for (const q of queries.slice(0, 3)) {
        const u = `${API}/search?part=snippet&type=video&videoDuration=short&order=viewCount&maxResults=${per}&q=${encodeURIComponent(`${q} #shorts`)}${lang ? `&relevanceLanguage=${lang}` : ""}&key=${key}`;
        const j = await okJson<{ items: SearchItem[] }>(await fetchRetry(u, { signal: ctx.signal }), "youtube search");
        ids.push(...j.items.filter((i) => i.id.videoId));
      }
      const uniq = [...new Map(ids.map((i) => [i.id.videoId!, i])).values()].slice(0, ctx.limit);
      if (!uniq.length) return { result: [], usd: 0 };
      const v = await okJson<{
        items: { id: string; statistics: Record<string, string>; contentDetails: { duration: string } }[];
      }>(
        await fetchRetry(
          `${API}/videos?part=statistics,contentDetails&id=${uniq.map((i) => i.id.videoId).join(",")}&key=${key}`,
          { signal: ctx.signal },
        ),
        "youtube videos",
      );
      const chIds = [...new Set(uniq.map((i) => i.snippet.channelId))];
      const c = await okJson<{ items: { id: string; statistics: Record<string, string> }[] }>(
        await fetchRetry(`${API}/channels?part=statistics&id=${chIds.join(",")}&key=${key}`, { signal: ctx.signal }),
        "youtube channels",
      );
      const subs = new Map(c.items.map((x) => [x.id, num(x.statistics.subscriberCount)]));
      const stats = new Map(v.items.map((x) => [x.id, x]));
      const items: Evidence[] = uniq.map((i) => {
        const s = stats.get(i.id.videoId!);
        const e = baseEvidence(ctx, "youtube", "video", i.snippet.title);
        e.url = `https://www.youtube.com/shorts/${i.id.videoId}`;
        e.author = i.snippet.channelTitle;
        e.thumbnailUrl = i.snippet.thumbnails?.high?.url;
        e.text = i.snippet.description.slice(0, 500) || undefined;
        e.metrics = {
          views: num(s?.statistics.viewCount),
          likes: num(s?.statistics.likeCount),
          comments: num(s?.statistics.commentCount),
          followers: subs.get(i.snippet.channelId),
        };
        const len = isoDurationSec(s?.contentDetails.duration);
        e.deconstruction = len ? { lengthSec: len } : undefined;
        e.tags = ["shorts"];
        return e;
      });
      return { result: items, usd: 0, units: `${3 + queries.length} API calls` };
    },
  });
  return { source: "youtube", items: out.value, mode: out.mode, usd: out.usd };
}
