"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Page, PageHead } from "@/components/shell/PageHead";
import { DemoBadge, RunStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { type PhaseState, phaseStates } from "@/components/ui/PhaseRail";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { type Asset, type BrandSummary, PHASES } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { PHASE_LABELS, timeAgo, VERTICAL_LABELS } from "@/lib/client/format";
import { MOCK_VIDEO } from "@/lib/client/mock/client";
import { useBrands, useConnections } from "@/lib/client/queries";
import { displayHost } from "@/lib/client/url";
import { BrandMark } from "./BrandMark";

export function Portfolio() {
  const { data, isLoading, error, refetch } = useBrands();
  return (
    <Page>
      <PageHead
        eyebrow={`Portfolio / ${data?.length ?? 0} brands`}
        title="Every brand you run."
        actions={
          <Button variant="primary" asChild>
            <Link href="/brands/new">Add a brand</Link>
          </Button>
        }
      >
        One engine, one memory, a separate rule pack per brand. Open a brand to see its dossier, runs and results.
      </PageHead>

      {error ? (
        <ErrorState title="Could not reach the engine" error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={5} className="h-[520px]" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          title="No brands yet"
          action={
            <Button variant="primary" asChild>
              <Link href="/brands/new">Add the first brand</Link>
            </Button>
          }
        >
          Paste a website and the agent builds the dossier from it.
        </EmptyState>
      ) : (
        <ul className="grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="brand-grid">
          {data.map((b) => (
            <li key={b.id} className="rise">
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

type Render = { video?: Asset; keyframe?: Asset };

/** The newest remake render (video) or engine keyframe across the brand's last runs. Never the mock placeholder. */
async function latestRender(brandId: string): Promise<Render | null> {
  const c = getClient();
  const runs = (await c.brandRuns(brandId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  for (const run of runs) {
    const concepts = await c.concepts(run.id).catch(() => []);
    const remake = concepts.find((x) => x.blueprintId && !x.variantOf) ?? concepts.find((x) => x.videoAssetId);
    if (!remake) continue;
    const assets = await c.conceptAssets(remake.id).catch(() => []);
    const video = assets.filter((a) => a.kind === "video" && a.url !== MOCK_VIDEO).at(-1);
    const keyframe = assets.filter((a) => a.kind === "keyframe").sort((a, b) => (a.shotIdx ?? 0) - (b.shotIdx ?? 0))[0];
    if (video || keyframe) return { video, keyframe };
  }
  return null;
}

function BrandCard({ brand: b }: { brand: BrandSummary }) {
  const { data: conns } = useConnections(b.id);
  const { data: render } = useQuery({
    queryKey: ["latestRender", b.id],
    queryFn: () => latestRender(b.id),
    staleTime: 60_000,
  });
  const live = conns?.filter((c) => c.status === "live").length ?? 0;
  const demo = conns?.filter((c) => c.status === "demo").length ?? 0;
  const run = b.lastRun;
  const active = run?.status === "running" || run?.status === "waiting_input";
  const where = [VERTICAL_LABELS[b.vertical] ?? b.vertical, b.countries.slice(0, 4).join(", ")]
    .filter(Boolean)
    .join(" / ");
  return (
    <Link
      href={`/brands/${b.slug}`}
      data-testid={`brand-card-${b.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-raised transition-colors duration-150 hover:border-bone-4"
    >
      <Media brand={b} render={render ?? undefined} />

      <div className="flex flex-1 flex-col p-5">
        <header className="flex items-center gap-3">
          <BrandMark brand={b} size={36} className="rounded-[6px]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-[18px] text-bone leading-tight tracking-[-0.015em]">{b.name}</h2>
            <p className="truncate text-[12.5px] text-bone-3">{hostname(b.url)}</p>
          </div>
          {b.demo && <DemoBadge label="Demo" />}
        </header>
        <p className="mt-4 line-clamp-2 min-h-[2.9em] text-bone text-ui">
          {b.dossier.oneLiner || "Dossier pending: the agent has not read the site yet."}
        </p>
        <p className="mt-1.5 truncate text-[12.5px] text-bone-3">{where}</p>

        <PhaseStrip run={run} />

        <dl className="mt-4 grid grid-cols-3 border-line border-t">
          <Stat label="views">
            <NumberTicker value={b.counts.totalViews} from={0} />
          </Stat>
          <Stat label="ready">{b.counts.packsReady}</Stat>
          <Stat label="posted">{b.counts.packsPosted}</Stat>
        </dl>

        <footer className="mt-1 flex items-center justify-between gap-2 border-line border-t pt-3 text-[12px] text-bone-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-1.5 rounded-full", live ? "bg-pass" : "bg-bone-4")} />
            <span className="tabular-nums">
              {live} live, {demo} demo sources
            </span>
          </span>
          {run && active && <RunStatusBadge status={run.status} />}
        </footer>
      </div>
    </Link>
  );
}

/** Brand imagery leads the card; the latest render sits beside it when the engine has made one. */
function Media({ brand, render }: { brand: BrandSummary; render?: Render }) {
  const [art] = referenceImages(brand);
  const [broken, setBroken] = useState<string[]>([]);
  const ok = (u?: string) => (u && !broken.includes(u) ? u : undefined);
  const drop = (u: string) => () => setBroken((b) => [...b, u]);
  const image = ok(art);
  const video = ok(render?.video?.url);
  const still = ok(render?.keyframe?.url);
  const secs = render?.video?.durationSec;
  return (
    <figure className="border-line border-b">
      <div className="flex aspect-[4/3] gap-px bg-line">
        <div className="relative min-w-0 flex-1 overflow-hidden bg-raised-2">
          {image ? (
            // biome-ignore lint/performance/noImgElement: brand-owned assets from the engine asset route
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={drop(image)}
              className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.015]"
            />
          ) : (
            <div className="flex h-full flex-col justify-end p-4">
              <span className="font-display text-[56px] text-bone-4 leading-none">{brand.name.slice(0, 1)}</span>
            </div>
          )}
        </div>
        {(video || still) && (
          <div className="relative aspect-[9/16] h-full shrink-0 overflow-hidden bg-viewer">
            {video ? (
              <video
                src={video}
                poster={still}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                onError={drop(video)}
                className="h-full w-full object-cover"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: engine keyframe from the asset route
              <img src={still} alt="" loading="lazy" onError={drop(still!)} className="h-full w-full object-cover" />
            )}
          </div>
        )}
      </div>
      <figcaption className="flex items-baseline justify-between gap-3 px-5 py-2 text-[11.5px] text-bone-3">
        <span className="truncate">{image ? "Brand imagery" : "No brand imagery yet"}</span>
        <span className="shrink-0">
          {video ? (
            <>Latest render{secs ? <span className="font-mono tabular-nums">, {Math.round(secs)}s</span> : null}</>
          ) : still ? (
            "Latest keyframe"
          ) : (
            "No render yet"
          )}
        </span>
      </figcaption>
    </figure>
  );
}

const RUN_PHASES = PHASES.filter((p) => p !== "measure");
const SEG: Record<PhaseState, string> = {
  done: "bg-bone",
  active: "bg-signal",
  waiting: "bg-warn",
  failed: "bg-fail",
  pending: "bg-line",
};

/** The last run as flat segments: where it got to, at a glance. */
function PhaseStrip({ run }: { run?: BrandSummary["lastRun"] }) {
  const states = run ? phaseStates(RUN_PHASES, run.phase, run.status) : RUN_PHASES.map(() => "pending" as PhaseState);
  const when = run?.finishedAt ? `finished ${timeAgo(run.finishedAt)}` : run ? run.status.replace("_", " ") : "";
  return (
    <div className="mt-auto pt-6">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-medium text-bone">Last run</span>
        <span className="truncate text-bone-3">{run ? `${PHASE_LABELS[run.phase]}, ${when}` : "none yet"}</span>
      </div>
      <div className="mt-2 flex gap-[2px]" aria-hidden>
        {states.map((st, i) => (
          <span key={RUN_PHASES[i]} className={cn("h-[5px] flex-1 rounded-[1px]", SEG[st])} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse border-line py-3 [&+&]:border-l [&+&]:pl-3">
      <dt className="mt-1.5 text-[12px] text-bone-3">{label}</dt>
      <dd className="font-mono text-[22px] text-bone leading-none tabular-nums">{children}</dd>
    </div>
  );
}

export const hostname = (u: string) => displayHost(u);
