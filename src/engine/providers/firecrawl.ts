import type { Db } from "../db/client";
import { loadFixture, saveFixture } from "../smoke/record";
import { callProvider } from "./call";
import { PRICES } from "./prices";

export interface ScrapeResult {
  url: string;
  markdown: string;
  title?: string;
  description?: string;
  language?: string;
  ogImage?: string;
  branding?: {
    colors?: Record<string, string>;
    fonts?: { family: string; role?: string }[];
    colorScheme?: string;
  };
  source: "firecrawl" | "direct" | "fixture";
}

const API = "https://api.firecrawl.dev/v2/scrape";

export function fixtureName(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "_");
}

/** Direct fetch fallback: strips tags, keeps title/description. Free, no provider. */
export async function directFetch(url: string, signal?: AbortSignal): Promise<ScrapeResult> {
  const res = await fetch(url, {
    signal,
    headers: { "user-agent": "Mozilla/5.0 (nexus intake bot)" },
    redirect: "follow",
  });
  const html = await res.text();
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(h[1-3])[^>]*>/gi, "\n# ")
    .replace(/<(p|li|div|br|section)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return {
    url,
    markdown: text.slice(0, 20000),
    title: pick(/<title[^>]*>([^<]*)<\/title>/i),
    description: pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i),
    language: pick(/<html[^>]+lang=["']([^"']+)/i),
    ogImage: pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i),
    source: "direct",
  };
}

async function liveScrape(url: string, signal?: AbortSignal): Promise<ScrapeResult> {
  const res = await fetch(API, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "branding"], onlyMainContent: false, timeout: 45000 }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    data?: {
      markdown?: string;
      metadata?: Record<string, unknown>;
      branding?: ScrapeResult["branding"];
    };
  };
  const md = j.data?.metadata ?? {};
  const str = (v: unknown) => (Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : undefined);
  return {
    url,
    markdown: (j.data?.markdown ?? "").replace(/!\[\]\(<Base64-Image-Removed>\)/g, "").slice(0, 30000),
    title: str(md.title),
    description: str(md.description),
    language: str(md.language),
    ogImage: str(md.ogImage ?? md["og:image"]),
    branding: j.data?.branding
      ? { colors: j.data.branding.colors, fonts: j.data.branding.fonts, colorScheme: j.data.branding.colorScheme }
      : undefined,
    source: "firecrawl",
  };
}

/**
 * Scrape one page. Live: Firecrawl (recorded to fixtures/live/firecrawl/<host>.json for replay).
 * Demo: the recorded fixture if one exists, else a free direct fetch (falls back to empty on network errors).
 */
export async function scrape(
  db: Db,
  url: string,
  o: { runId?: string; signal?: AbortSignal; record?: boolean } = {},
): Promise<{ page: ScrapeResult; mode: "live" | "demo" }> {
  const out = await callProvider(db, {
    provider: "firecrawl",
    note: `scrape ${url}`,
    runId: o.runId,
    estimateUsd: PRICES.firecrawl.perPage * 2,
    live: async () => {
      const page = await liveScrape(url, o.signal);
      if (o.record !== false) saveFixture("firecrawl", fixtureName(url), { page });
      return { result: page, usd: PRICES.firecrawl.perPage * 2, units: "1 page + branding" };
    },
    demo: async () => {
      const fx = loadFixture<{ page: ScrapeResult }>("firecrawl", fixtureName(url));
      if (fx) return { ...fx.page, source: "fixture" as const };
      if (process.env.NEXUS_TEST === "1") return { url, markdown: "", source: "fixture" as const };
      try {
        return await directFetch(url, o.signal);
      } catch {
        return { url, markdown: "", source: "fixture" as const };
      }
    },
  });
  return { page: out.value, mode: out.mode };
}
