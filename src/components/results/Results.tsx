"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page, PageHead } from "@/components/shell/PageHead";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CHANNEL_LABELS, type Learning, type ResultsResponse } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { useFieldActivity } from "@/lib/client/field";
import { timeAgo } from "@/lib/client/format";
import { qk, useBrand } from "@/lib/client/queries";
import {
  byTime,
  type Counters,
  latestCounters,
  type Metric,
  niceMax,
  safeHttpUrl,
  sumCounters,
  viewSeries,
} from "./chart";
import { ViewsChart } from "./ViewsChart";

type PostedPack = ResultsResponse["packs"][number];

const REFRESH_MS = 15_000;
const SECONDARY: Metric[] = ["likes", "comments", "shares", "saves", "follows"];

/** Re-renders every 30 s so "posted 6 h ago" stays true between refetches. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Results({ slug }: { slug: string }) {
  const { data: brand } = useBrand(slug);
  // Same cache key as useResults; polled so counters tick when a new snapshot lands.
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.results(slug),
    queryFn: () => getClient().results(slug),
    refetchInterval: REFRESH_MS,
  });
  const now = useNow();
  useFieldActivity(0.15, "cyan");
  const name = brand?.name ?? slug;

  return (
    <Page>
      <PageHead
        eyebrow={`Results / ${name}`}
        title="What the posts did."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10.5px] text-bone-3 sm:inline">checks every 15 s</span>
            <Button
              variant="quiet"
              size="sm"
              data-testid="results-refresh"
              onClick={() => refetch()}
              aria-busy={isFetching || undefined}
              className="shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              <RefreshGlyph spinning={isFetching} />
              Refresh
            </Button>
          </div>
        }
      >
        Numbers come from the posts you mark posted, entered by hand or read by API. Nothing is estimated.
      </PageHead>

      {error ? (
        <ErrorState title="Could not load results" error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingResults />
      ) : !data.packs.length ? (
        <div className="flex flex-col gap-3">
          <EmptyState
            title="Waiting for first metrics"
            className="rise py-20"
            action={
              <Button variant="ghost" asChild>
                <Link href={`/brands/${slug}`}>Open {name}</Link>
              </Button>
            }
          >
            <span data-testid="results-empty">
              Nothing from {name} is marked posted yet. Post a pack from a run&apos;s Packs screen, paste its link, then
              enter the numbers the platform shows. They appear here as they land.
            </span>
          </EmptyState>
          {data.learnings.length > 0 && <Learnings learnings={data.learnings} now={now} />}
        </div>
      ) : (
        <Board data={data} now={now} />
      )}
    </Page>
  );
}

function Board({ data, now }: { data: ResultsResponse; now: number }) {
  const packs = [...data.packs].sort(
    (a, b) => Date.parse(b.postedAt ?? b.createdAt) - Date.parse(a.postedAt ?? a.createdAt),
  );
  const rows = packs.map((p) => ({
    pack: p,
    counters: latestCounters(p.snapshots),
    points: viewSeries(p.snapshots, p.postedAt),
  }));
  const totals = sumCounters(rows.map((r) => r.counters));
  // One scale for the whole grid: small multiples are only comparable if they share axes.
  const xMax = Math.max(1, ...rows.flatMap((r) => r.points.map((p) => p.t)));
  const yMax = niceMax(Math.max(0, ...rows.flatMap((r) => r.points.map((p) => p.v))));
  const measured = rows.filter((r) => r.pack.snapshots.length).length;

  return (
    <div className="flex flex-col gap-3">
      <Totals totals={totals} packs={rows.length} measured={measured} />
      <div className="grid items-start gap-3 xl:grid-cols-12">
        <section aria-labelledby="posts-h" className="flex min-w-0 flex-col gap-3 xl:col-span-8">
          <h2 id="posts-h" className="sr-only">
            Posted packs
          </h2>
          <ul className="flex flex-col gap-3" data-testid="results-packs">
            {rows.map((r, i) => (
              <li key={r.pack.id} className="rise" style={{ animationDelay: `${180 + i * 60}ms` }}>
                <PackRow {...r} xMax={xMax} yMax={yMax} now={now} />
              </li>
            ))}
          </ul>
        </section>
        <div className="rise xl:sticky xl:top-20 xl:col-span-4" style={{ animationDelay: "240ms" }}>
          <Learnings learnings={data.learnings} now={now} />
        </div>
      </div>
    </div>
  );
}

function Totals({ totals, packs, measured }: { totals: Counters; packs: number; measured: number }) {
  return (
    <Panel as="section" aria-labelledby="totals-h" className="rise overflow-hidden" style={{ animationDelay: "120ms" }}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
        <h2 id="totals-h" className="mono-label">
          Across {packs} posted {packs === 1 ? "pack" : "packs"}
        </h2>
        <p className="font-mono text-[10.5px] text-bone-3">
          latest snapshot per pack, {measured} of {packs} measured
        </p>
      </header>
      <dl data-testid="results-totals" className="grid grid-cols-3 gap-px border-line border-t bg-line md:grid-cols-6">
        {(["views", ...SECONDARY] as Metric[]).map((m) => (
          <div key={m} className="bg-[rgb(10_12_16/0.72)] px-5 py-4">
            <dt className="mono-label flex items-center gap-1.5">
              {m === "views" && <span aria-hidden className="h-0.5 w-2.5 rounded-full bg-cyan" />}
              {m}
            </dt>
            <dd className="mt-2 text-[clamp(1.375rem,2.4vw,2rem)] text-bone leading-none" data-testid={`total-${m}`}>
              <Count value={totals[m]} from={0} />
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function PackRow({
  pack,
  counters,
  points,
  xMax,
  yMax,
  now,
}: {
  pack: PostedPack;
  counters: Counters;
  points: ReturnType<typeof viewSeries>;
  xMax: number;
  yMax: number;
  now: number;
}) {
  const platform = CHANNEL_LABELS[pack.platform] ?? pack.platform;
  const last = byTime(pack.snapshots).at(-1);
  const n = pack.snapshots.length;
  return (
    <article
      data-testid={`result-pack-${pack.id}`}
      className="glass-flat grid overflow-hidden md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4 border-line border-b p-5 md:border-r md:border-b-0">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Badge>{platform}</Badge>
          {pack.postedAt && (
            <span className="truncate font-mono text-[11px] text-bone-3">posted {timeAgo(pack.postedAt, now)}</span>
          )}
        </header>
        <div>
          <p className="text-[2.5rem] text-bone leading-none tracking-[-0.02em]" data-testid="pack-views">
            <Count value={counters.views} />
          </p>
          <p className="mt-2 font-mono text-[10.5px] text-bone-3">
            <span className="mono-label">views</span>
            {last && (
              <>
                {" "}
                {last.source === "api" ? "read by API" : "entered by hand"} {timeAgo(last.capturedAt, now)}
              </>
            )}
          </p>
        </div>
        <p className="line-clamp-2 text-bone-2 text-ui">{pack.caption}</p>
        <PostedLink url={pack.postedUrl} />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <span className="mono-label">Views since posting</span>
          <span className="font-mono text-[10.5px] text-bone-3 tabular-nums" data-testid="snapshot-count">
            {n} {n === 1 ? "snapshot" : "snapshots"}
          </span>
        </div>
        <div className="px-5 pt-3 pb-4">
          {points.length ? (
            <ViewsChart points={points} xMax={xMax} yMax={yMax} label={`${platform} post`} />
          ) : (
            <Waiting entered={n > 0} />
          )}
        </div>
        <dl className="mt-auto grid grid-cols-5 gap-px border-line border-t bg-line">
          {SECONDARY.map((m) => (
            <div key={m} className="min-w-0 bg-[rgb(10_12_16/0.6)] px-2.5 py-3 sm:px-4">
              <dt className="mono-label truncate text-[9px] tracking-[0.04em] sm:text-[10px] sm:tracking-[0.08em]">
                {m}
              </dt>
              <dd className="mt-1.5 text-bone text-ui" data-testid={`pack-${m}`}>
                <Count value={counters[m]} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/** A metric nobody recorded shows as not recorded, never as 0. */
function Count({ value, from }: { value?: number; from?: number }) {
  if (value == null)
    return (
      <span className="font-mono text-bone-4" title="Not recorded yet">
        <span aria-hidden>–</span>
        <span className="sr-only">not recorded</span>
      </span>
    );
  return <NumberTicker value={value} from={from} />;
}

function Waiting({ entered }: { entered: boolean }) {
  return (
    <div
      data-testid="chart-waiting"
      className="relative grid h-[156px] place-items-center overflow-hidden rounded-cell bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_44px,var(--color-line-faint)_44px,var(--color-line-faint)_45px)]"
    >
      <span aria-hidden className="absolute inset-x-0 bottom-[22px] h-px bg-line-strong" />
      <div className="relative max-w-xs px-4 text-center">
        <p className="font-serif text-[22px] text-bone leading-tight">Waiting for first metrics</p>
        <p className="mt-1.5 text-bone-3 text-ui">
          {entered
            ? "Snapshots so far have no view count. Add views to draw the line."
            : "Enter the numbers from the post, or connect the platform to read them."}
        </p>
      </div>
    </div>
  );
}

function PostedLink({ url }: { url?: string }) {
  if (!url) return null;
  const u = safeHttpUrl(url);
  const text = u ? `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}` : url;
  const cls = "flex min-w-0 items-center gap-1.5 font-mono text-[11px]";
  if (!u) return <span className={cn(cls, "text-bone-3")}>{text}</span>;
  return (
    <a
      href={u.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="posted-link"
      className={cn(
        cls,
        "group mt-auto self-start rounded-cell text-bone-2 transition-colors duration-150 hover:text-bone",
      )}
    >
      <span className="truncate underline decoration-line-strong underline-offset-4 group-hover:decoration-bone-3">
        {text}
      </span>
      <svg viewBox="0 0 12 12" className="size-3 shrink-0" fill="none" aria-hidden>
        <path d="M4 8 8 4M4.5 4H8v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">(opens the post in a new tab)</span>
    </a>
  );
}

const CONFIDENCE: Record<Learning["confidence"], { tone: "neutral" | "violet" | "cyan"; level: number }> = {
  low: { tone: "neutral", level: 1 },
  medium: { tone: "violet", level: 2 },
  high: { tone: "cyan", level: 3 },
};

function Learnings({ learnings, now }: { learnings: Learning[]; now: number }) {
  return (
    <Panel tone="flat" as="section" aria-label="Learnings" data-testid="learnings">
      <PanelHeader
        label="Learnings"
        title="What beat the median"
        aside={<span className="font-mono text-[10.5px] text-bone-3 tabular-nums">{learnings.length}</span>}
      />
      {learnings.length ? (
        <ol className="divide-y divide-line">
          {learnings.map((l) => {
            const c = CONFIDENCE[l.confidence];
            return (
              <li key={l.id} className="flex flex-col gap-2 px-5 py-4">
                <p className="text-bone text-body">{l.insight}</p>
                <p className="text-bone-2 text-ui">{l.evidence}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={c.tone} title={`Confidence: ${l.confidence}`}>
                    <span aria-hidden className="flex items-end gap-[2px]">
                      {[1, 2, 3].map((k) => (
                        <span
                          key={k}
                          className={cn("w-[3px] rounded-[1px] bg-current", k > c.level && "opacity-25")}
                          style={{ height: 3 + k * 2 }}
                        />
                      ))}
                    </span>
                    {l.confidence}
                  </Badge>
                  <span className="font-mono text-[10.5px] text-bone-3">
                    {l.brandId ? "" : "all brands, "}
                    {timeAgo(l.createdAt, now)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 py-6 text-bone-2 text-ui" data-testid="learnings-empty">
          Learnings appear after metrics arrive. The agent compares each post with the brand&apos;s median and writes
          down which hook or format beat it, with the numbers behind it.
        </p>
      )}
    </Panel>
  );
}

function LoadingResults() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Loading results">
      <div className="glass-flat grid grid-cols-3 gap-4 p-5 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className="flex flex-col gap-3 xl:col-span-8">
          {[0, 1].map((i) => (
            <div key={i} className="glass-flat grid gap-6 p-5 md:grid-cols-[16rem_1fr]">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-20 rounded-chip" />
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-[156px]" />
            </div>
          ))}
        </div>
        <SkeletonCard lines={4} className="xl:col-span-4" />
      </div>
    </div>
  );
}

function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5", spinning && "animate-spin [animation-duration:900ms]")}
      fill="none"
      aria-hidden
    >
      <path
        d="M13 8a5 5 0 1 1-1.46-3.54M13 3v2.5h-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
