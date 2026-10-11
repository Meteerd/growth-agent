"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CHANNEL_LABELS, type Learning, type ResultsResponse } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
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
  const name = brand?.name ?? slug;

  // BrandFrame already gives the page its frame and h1 (the brand); this screen opens with its own h2.
  return (
    <div>
      <header className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] text-bone leading-[1.05]">
            What the posts did.
          </h2>
          <p className="mt-2 max-w-2xl text-bone-2 text-body">
            Numbers come from the posts you mark posted, entered by hand or read by API. Nothing is estimated.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-[12px] text-bone-3 sm:inline">Checks every 15 s</span>
          <Button size="sm" data-testid="results-refresh" onClick={() => refetch()} aria-busy={isFetching || undefined}>
            <RefreshGlyph spinning={isFetching} />
            Refresh
          </Button>
        </div>
      </header>

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
    </div>
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
      <div className="grid-cols-1 grid items-start gap-3 xl:grid-cols-12">
        <section aria-labelledby="posts-h" className="flex min-w-0 flex-col gap-3 xl:col-span-8">
          <h2 id="posts-h" className="sr-only">
            Posted packs
          </h2>
          <ul className="flex flex-col gap-3" data-testid="results-packs">
            {rows.map((r) => (
              <li key={r.pack.id} className="rise">
                <PackRow {...r} xMax={xMax} yMax={yMax} now={now} />
              </li>
            ))}
          </ul>
        </section>
        <div className="rise xl:sticky xl:top-20 xl:col-span-4">
          <Learnings learnings={data.learnings} now={now} />
        </div>
      </div>
    </div>
  );
}

function Totals({ totals, packs, measured }: { totals: Counters; packs: number; measured: number }) {
  return (
    <section aria-labelledby="totals-h" className="rise overflow-hidden rounded-panel border border-line bg-raised">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
        <h2 id="totals-h" className="mono-label">
          Across {packs} posted {packs === 1 ? "pack" : "packs"}
        </h2>
        <p className="text-[12px] text-bone-3">
          Latest snapshot per pack, <span className="font-mono tabular-nums">{measured}</span> of{" "}
          <span className="font-mono tabular-nums">{packs}</span> measured
        </p>
      </header>
      <dl data-testid="results-totals" className="grid grid-cols-3 gap-px border-line border-t bg-line md:grid-cols-6">
        {(["views", ...SECONDARY] as Metric[]).map((m) => (
          <div key={m} className="flex flex-col-reverse bg-raised px-5 py-4">
            <dt className="mt-2 flex items-center gap-1.5 text-[12px] text-bone-2">
              {m === "views" && <span aria-hidden className="h-0.5 w-2.5 bg-cyan" />}
              {m}
            </dt>
            <dd className="text-[clamp(1.375rem,2.4vw,2rem)] text-bone leading-none" data-testid={`total-${m}`}>
              <Count value={totals[m]} from={0} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
      className="grid-cols-1 grid overflow-hidden rounded-panel border border-line bg-raised md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4 border-line border-b p-5 md:border-r md:border-b-0">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-semibold text-[14px] text-bone">{platform}</span>
          {pack.postedAt && (
            <span className="truncate text-[12px] text-bone-3">posted {timeAgo(pack.postedAt, now)}</span>
          )}
        </header>
        <div>
          <p className="text-[2.5rem] text-bone leading-none tracking-[-0.02em]" data-testid="pack-views">
            <Count value={counters.views} />
          </p>
          <p className="mt-2 text-[12px] text-bone-3">
            <span className="font-medium text-bone-2">views</span>
            {last && (
              <>
                , {last.source === "api" ? "read by API" : "entered by hand"} {timeAgo(last.capturedAt, now)}
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
          <span className="font-mono text-[11px] text-bone-3 tabular-nums" data-testid="snapshot-count">
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
            <div key={m} className="flex min-w-0 flex-col-reverse bg-raised px-2.5 py-3 sm:px-4">
              <dt className="mt-1 truncate text-[11px] text-bone-3 sm:text-[12px]">{m}</dt>
              <dd className="text-bone text-ui" data-testid={`pack-${m}`}>
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
    <div data-testid="chart-waiting" className="relative grid h-[156px] place-items-center overflow-hidden">
      {/* empty axes, the same rules the chart draws */}
      <span aria-hidden className="absolute inset-x-0 top-[20px] h-px bg-line-faint" />
      <span aria-hidden className="absolute inset-x-0 top-[77px] h-px bg-line-faint" />
      <span aria-hidden className="absolute inset-x-0 bottom-[22px] h-px bg-line-strong" />
      <div className="relative max-w-xs bg-raised px-4 text-center">
        <p className="font-semibold text-[17px] text-bone leading-tight">Waiting for first metrics</p>
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
  const cls = "flex min-w-0 items-center gap-1.5 font-mono text-[12px]";
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

const LEVEL: Record<Learning["confidence"], number> = { low: 1, medium: 2, high: 3 };

function Learnings({ learnings, now }: { learnings: Learning[]; now: number }) {
  return (
    <Panel tone="flat" as="section" aria-label="Learnings" data-testid="learnings">
      <PanelHeader
        label="Learnings"
        title="What beat the median"
        aside={<span className="font-mono text-[11px] text-bone-3 tabular-nums">{learnings.length}</span>}
      />
      {learnings.length ? (
        <ol className="divide-y divide-line">
          {learnings.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-5 py-4">
              <p className="text-bone text-body">{l.insight}</p>
              <p className="text-bone-2 text-ui">{l.evidence}</p>
              <p className="mt-1 flex items-center gap-2 text-[12px] text-bone-3">
                <span
                  className={cn("flex items-center gap-1.5", l.confidence === "high" ? "text-cyan" : "text-bone-2")}
                >
                  <span aria-hidden className="flex items-end gap-[2px]">
                    {[1, 2, 3].map((k) => (
                      <span
                        key={k}
                        className={cn("w-[3px] rounded-[1px] bg-current", k > LEVEL[l.confidence] && "opacity-25")}
                        style={{ height: 3 + k * 2 }}
                      />
                    ))}
                  </span>
                  {l.confidence} confidence
                </span>
                <span>
                  {l.brandId ? "" : "all brands, "}
                  {timeAgo(l.createdAt, now)}
                </span>
              </p>
            </li>
          ))}
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
      <div className="grid-cols-1 grid items-start gap-3 xl:grid-cols-12">
        <div className="flex flex-col gap-3 xl:col-span-8">
          {[0, 1].map((i) => (
            <div key={i} className="grid-cols-1 glass-flat grid gap-6 p-5 md:grid-cols-[16rem_1fr]">
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
