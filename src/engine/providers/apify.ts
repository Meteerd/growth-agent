import type { Evidence } from "@/contracts";
import { baseEvidence, demoFor, num, type SourceCtx, type SourceResult, str } from "../research/types";
import { saveFixture } from "../smoke/record";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";
import { PRICES } from "./prices";

export const ACTORS = {
  tiktok: "clockworks/tiktok-scraper",
  instagram: "apify/instagram-scraper",
  reddit: "trudax/reddit-scraper-lite",
  metaAds: "curious_coder/facebook-ads-library-scraper",
} as const;

type Item = Record<string, unknown>;

/** Run an actor synchronously and return its dataset items (max 300 s). */
export async function runActor(actor: string, input: object, maxItems: number, signal?: AbortSignal): Promise<Item[]> {
  const url = `https://api.apify.com/v2/acts/${actor.replace("/", "~")}/run-sync-get-dataset-items?timeout=240&maxItems=${maxItems}&format=json&clean=true`;
  const res = await fetchRetry(url, {
    method: "POST",
    signal,
    timeoutMs: 280_000,
    retries: 1,
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return okJson<Item[]>(res, `apify ${actor}`);
}

const get = (o: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), o);

export function normTikTok(ctx: SourceCtx, it: Item): Evidence {
  const e = baseEvidence(ctx, "tiktok", "video", str(it.text) ?? "TikTok video");
  e.url = str(it.webVideoUrl);
  e.author = str(get(it, "authorMeta.name")) ? `@${str(get(it, "authorMeta.name"))}` : undefined;
  e.thumbnailUrl = str(get(it, "videoMeta.coverUrl"));
  e.mediaUrl = str(get(it, "mediaUrls.0")) ?? str(get(it, "videoMeta.downloadAddr"));
  e.text = str(it.text);
  e.metrics = {
    views: num(it.playCount),
    likes: num(it.diggCount),
    comments: num(it.commentCount),
    shares: num(it.shareCount),
    followers: num(get(it, "authorMeta.fans")),
  };
  const len = num(get(it, "videoMeta.duration"));
  if (len) e.deconstruction = { lengthSec: len };
  e.tags = ((it.hashtags as { name?: string }[] | undefined) ?? [])
    .map((h) => h.name)
    .filter((x): x is string => !!x)
    .slice(0, 8);
  return e;
}

export function normInstagram(ctx: SourceCtx, it: Item): Evidence {
  const isVideo = it.type === "Video" || !!it.videoUrl;
  const e = baseEvidence(
    ctx,
    "instagram",
    isVideo ? "video" : "post",
    str(it.caption)?.split("\n")[0] ?? "Instagram post",
  );
  e.url = str(it.url);
  e.author = str(it.ownerUsername) ? `@${str(it.ownerUsername)}` : undefined;
  e.thumbnailUrl = str(it.displayUrl);
  e.mediaUrl = str(it.videoUrl);
  e.text = str(it.caption)?.slice(0, 800);
  e.metrics = {
    views: num(it.videoPlayCount) ?? num(it.videoViewCount),
    likes: num(it.likesCount),
    comments: num(it.commentsCount),
  };
  const len = num(it.videoDuration);
  if (len) e.deconstruction = { lengthSec: len };
  e.tags = ((it.hashtags as string[] | undefined) ?? []).slice(0, 8);
  return e;
}

export function normReddit(ctx: SourceCtx, it: Item): Evidence {
  const sub = str(it.communityName) ?? str(it.parsedCommunityName);
  const e = baseEvidence(
    ctx,
    "reddit",
    "thread",
    `${sub ? `${sub.startsWith("r/") ? sub : `r/${sub}`}: ` : ""}${str(it.title) ?? "Reddit thread"}`,
  );
  e.url = str(it.url);
  e.author = str(it.username) ? `u/${str(it.username)}` : undefined;
  e.text = str(it.body)?.slice(0, 1200);
  e.metrics = { likes: num(it.upVotes), comments: num(it.numberOfComments) };
  e.tags = ["community", ...(sub ? [sub] : [])];
  return e;
}

export function normMetaAd(ctx: SourceCtx, it: Item): Evidence {
  const snap = (it.snapshot ?? {}) as Item;
  const body = str(get(snap, "body.text")) ?? str(snap.caption) ?? "";
  const page = str(it.page_name) ?? str(snap.page_name);
  const e = baseEvidence(ctx, "meta_ad_library", "ad", `${page ?? "Advertiser"}: ${body.split("\n")[0] || "ad"}`);
  e.author = page;
  const id = str(it.ad_archive_id) ?? str(it.adArchiveID);
  e.url = id ? `https://www.facebook.com/ads/library/?id=${id}` : undefined;
  e.text = body.slice(0, 800) || undefined;
  const video = (snap.videos as Item[] | undefined)?.[0];
  e.mediaUrl = str(video?.video_hd_url) ?? str(video?.video_sd_url);
  e.thumbnailUrl = str(video?.video_preview_image_url) ?? str(get(snap, "images.0.original_image_url"));
  const start = num(it.start_date);
  const end = it.is_active ? Date.now() / 1000 : (num(it.end_date) ?? Date.now() / 1000);
  e.metrics = { daysRunning: start ? Math.max(0, Math.round((end - start) / 86400)) : undefined };
  e.deconstruction = { cta: str(snap.cta_text), format: e.mediaUrl ? "video" : "static" };
  e.tags = ["paid", ...(it.is_active ? ["active"] : [])];
  return e;
}

async function apifySource(
  ctx: SourceCtx,
  source: Evidence["source"],
  actor: string,
  input: object,
  norm: (ctx: SourceCtx, it: Item) => Evidence,
  note: string,
  perItem: number = PRICES.apify.perItem,
): Promise<SourceResult> {
  const out = await callProvider(ctx.db, {
    provider: "apify",
    note,
    runId: ctx.runId,
    estimateUsd: ctx.limit * perItem + 0.02,
    demo: () => demoFor(ctx, source),
    live: async () => {
      const raw = await runActor(actor, input, ctx.limit, ctx.signal);
      saveFixture("apify", `${ctx.brand.slug}_${source}`, { actor, input, items: raw.slice(0, ctx.limit) });
      const items = raw.slice(0, ctx.limit).map((it) => norm(ctx, it));
      return { result: items, usd: raw.length * perItem + 0.01, units: `${raw.length} items` };
    },
  });
  return { source, items: out.value, mode: out.mode, usd: out.usd };
}

export const tiktokSearch = (ctx: SourceCtx, hashtags: string[], queries: string[]) =>
  apifySource(
    ctx,
    "tiktok",
    ACTORS.tiktok,
    {
      hashtags: hashtags.map((h) => h.replace(/^#/, "")).slice(0, 3),
      searchQueries: queries.slice(0, 2),
      resultsPerPage: Math.ceil(ctx.limit / 3),
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    },
    normTikTok,
    `tiktok: ${[...hashtags, ...queries].join(", ")}`,
  );

export const instagramSearch = (ctx: SourceCtx, hashtags: string[]) =>
  apifySource(
    ctx,
    "instagram",
    ACTORS.instagram,
    {
      directUrls: hashtags
        .slice(0, 2)
        .map((h) => `https://www.instagram.com/explore/tags/${encodeURIComponent(h.replace(/^#/, ""))}/`),
      resultsType: "posts",
      resultsLimit: Math.ceil(ctx.limit / 2),
    },
    normInstagram,
    `instagram: ${hashtags.join(", ")}`,
  );

export const redditSearch = (ctx: SourceCtx, queries: string[], community?: string) =>
  apifySource(
    ctx,
    "reddit",
    ACTORS.reddit,
    {
      searches: queries.slice(0, 3),
      ...(community ? { searchCommunityName: community.replace(/^r\//, "") } : {}),
      searchPosts: true,
      searchComments: false,
      searchCommunities: false,
      searchUsers: false,
      ignoreStartUrls: true,
      startUrls: [],
      sort: "relevance",
      time: "year",
      maxItems: ctx.limit,
      maxPostCount: ctx.limit,
      skipComments: true,
      skipUserPosts: true,
      skipCommunity: true,
      includeNSFW: false,
    },
    normReddit,
    `reddit: ${queries.join(", ")}`,
  );

export const metaAdsSearch = (ctx: SourceCtx, queries: string[], country: string) =>
  apifySource(
    ctx,
    "meta_ad_library",
    ACTORS.metaAds,
    {
      urls: queries.slice(0, 2).map((q) => ({
        url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=video`,
      })),
      count: ctx.limit,
      limitPerSource: Math.ceil(ctx.limit / Math.max(1, Math.min(2, queries.length))),
    },
    normMetaAd,
    `meta ads (${country}): ${queries.join(", ")}`,
    PRICES.apify.perAdsItem,
  );
