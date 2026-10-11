"use client";

import Link from "next/link";
import { Page, PageHead } from "@/components/shell/PageHead";
import { Badge, DemoBadge, RunStatusBadge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { type PhaseState, phaseStates } from "@/components/ui/PhaseRail";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { type BrandSummary, PHASES } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { PHASE_LABELS, timeAgo, VERTICAL_LABELS } from "@/lib/client/format";
import { useBrands, useConnections } from "@/lib/client/queries";
import { BrandMark } from "./BrandMark";

export function Portfolio() {
  const { data, isLoading, error, refetch } = useBrands();
  const running = data?.some((b) => b.lastRun?.status === "running");
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={5} className="h-[360px]" />
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="brand-grid">
          {data.map((b, i) => (
            <li key={b.id} className="rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function BrandCard({ brand: b }: { brand: BrandSummary }) {
  const { data: conns } = useConnections(b.id);
  const live = conns?.filter((c) => c.status === "live").length ?? 0;
  const demo = conns?.filter((c) => c.status === "demo").length ?? 0;
  const run = b.lastRun;
  const active = run?.status === "running" || run?.status === "waiting_input";
  return (
    <Link
      href={`/brands/${b.slug}`}
      data-testid={`brand-card-${b.slug}`}
      className={cn(
        "glass-flat group relative flex h-full min-h-[360px] flex-col overflow-hidden p-5 transition-[transform,box-shadow] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow[var(--shadow-panel-strong)]",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(80%_100%_at_20%_0%,rgb(17_17_17/0.06),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <header className="flex items-start gap-3">
        <BrandMark brand={b} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium text-bone text-heading">{b.name}</h2>
          <p className="truncate font-mono text-[11px] text-bone-3">{hostname(b.url)}</p>
        </div>
        {b.demo && <DemoBadge label="Demo" />}
      </header>
      <p className="mt-5 line-clamp-2 min-h-[2.8em] text-bone-2 text-ui">
        {b.dossier.oneLiner || "Dossier pending: the agent has not read the site yet."}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge>{VERTICAL_LABELS[b.vertical] ?? b.vertical}</Badge>
        {b.countries.slice(0, 4).map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>

      <PhaseStrip run={run} />
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-card bg-line pt-px">
        <Stat label="views">
          <NumberTicker value={b.counts.totalViews} from={0} />
        </Stat>
        <Stat label="ready">{b.counts.packsReady}</Stat>
        <Stat label="posted">{b.counts.packsPosted}</Stat>
      </dl>
      <footer className="mt-4 flex items-center justify-between gap-2 font-mono text-[11px] text-bone-3">
        <span className="flex items-center gap-1.5">
          <StatusDot status={live ? "live" : "idle"} />
          {live} live, {demo} demo
        </span>
        {run ? (
          active ? (
            <RunStatusBadge status={run.status} />
          ) : (
            <span className="truncate">
              {run.finishedAt ? `finished ${timeAgo(run.finishedAt)}` : PHASE_LABELS[run.phase]}
            </span>
          )
        ) : (
          <span>no runs yet</span>
        )}
      </footer>
    </Link>
  );
}

const RUN_PHASES = PHASES.filter((p) => p !== "measure");
const SEG: Record<PhaseState, string> = {
  done: "bg-bone-3",
  active: "bg-signal ",
  waiting: "bg-warn",
  failed: "bg-fail",
  pending: "bg-line-strong",
};

/** The last run as ten segments: where it got to, at a glance. */
function PhaseStrip({ run }: { run?: BrandSummary["lastRun"] }) {
  const states = run ? phaseStates(RUN_PHASES, run.phase, run.status) : RUN_PHASES.map(() => "pending" as PhaseState);
  return (
    <div className="mt-auto pt-6">
      <div className="flex items-baseline justify-between">
        <span className="mono-label">last run</span>
        <span className="font-mono text-[10.5px] text-bone-3">
          {run ? `${PHASE_LABELS[run.phase]} / ${run.status.replace("_", " ")}` : "none yet"}
        </span>
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {states.map((st, i) => (
          <span key={RUN_PHASES[i]} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", SEG[st])} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-raised px-3 py-3">
      <dt className="mono-label">{label}</dt>
      <dd className="mt-1 font-mono text-bone text-heading">{children}</dd>
    </div>
  );
}

export const hostname = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
