"use client";

import { MotionConfig } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useRunCtx } from "@/components/run/RunContext";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { type Channel, type ChannelPlan, SCORE_AXES, SCORE_AXIS_LABELS } from "@/contracts";
import { useEvidence, usePlan } from "@/lib/client/queries";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { AXIS_SHORT, Bar } from "./parts";
import { RankedList } from "./RankedList";

export function Direction() {
  const { runId, events, revealed, connection } = useRunCtx();
  const plan = usePlan(runId);
  const evidence = useEvidence(runId);
  const [drawer, setDrawer] = useState<{ channel: Channel | null; open: boolean }>({ channel: null, open: false });

  const notFound = (plan.error as { status?: number } | null)?.status === 404;
  // The stream decides what the run has shown so far (replays included); before its first event, trust the API.
  const streamCaughtUp = events.length > 0 || connection !== "connecting";
  const shown =
    !!plan.data && (events.length === 0 || events.some((e) => e.type === "plan") || revealed.has(plan.data.id));

  if (plan.isLoading || (plan.data && !streamCaughtUp)) return <Loading />;
  if (notFound || (plan.data && !shown))
    return (
      <div data-testid="direction-empty">
        <EmptyState
          className="mx-auto mt-6 max-w-2xl bg-raised"
          title="Direction is not decided yet"
          action={
            <Button asChild>
              <Link href={`/runs/${runId}`}>Back to the cockpit</Link>
            </Button>
          }
        >
          The agent picks where to go after the consultation, from the evidence and your answers. Follow the run in the
          cockpit until then.
        </EmptyState>
      </div>
    );
  if (plan.error || !plan.data)
    return (
      <ErrorState
        className="mt-6"
        title="Could not load the channel plan"
        error={plan.error}
        onRetry={() => plan.refetch()}
      />
    );

  const p = plan.data;
  return (
    <MotionConfig reducedMotion="user">
      <div data-testid="direction" className="flex flex-col gap-10 pt-2">
        <PlanHead plan={p} />
        <RankedList
          plan={p}
          runId={runId}
          evidence={evidence.data}
          onOpen={(c) => setDrawer({ channel: c, open: true })}
        />
      </div>
      <EvidenceDrawer
        plan={p}
        channel={drawer.channel}
        open={drawer.open}
        onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))}
        evidence={evidence}
      />
    </MotionConfig>
  );
}

function PlanHead({ plan }: { plan: ChannelPlan }) {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex max-w-[1040px] flex-col gap-5">
        <p className="mono-label flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>Channel plan</span>
          <span
            data-testid="plan-version"
            className="inline-flex h-6 items-center rounded-card border border-line-strong bg-raised px-2 font-mono font-normal text-[11.5px] text-bone tabular-nums normal-case tracking-normal"
          >
            v{plan.version}
          </span>
          <span className="font-normal text-bone-3 normal-case tracking-normal">
            {plan.channels.length} channels, {plan.notNow.length} not now
          </span>
        </p>
        <h1 className="font-display text-[34px] leading-[1.04] md:text-[48px]">Where to go, and where not to.</h1>
        <p className="max-w-[64ch] text-[18px] text-bone leading-[1.5] tracking-[-0.005em] md:text-[20px]">
          {plan.summary}
        </p>
      </div>
      <Weights plan={plan} />
    </header>
  );
}

function Weights({ plan }: { plan: ChannelPlan }) {
  return (
    <section
      aria-labelledby="weights-h"
      data-testid="plan-weights"
      className="flex flex-col gap-3 border-line border-y py-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="weights-h" className="mono-label">
          How the score is weighted
        </h2>
        <p className="text-[12px] text-bone-3">Score = weighted sum of six axes, each scored 0 to 100</p>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {SCORE_AXES.map((a) => (
          <div key={a} className="flex min-w-0 flex-col gap-1.5" title={SCORE_AXIS_LABELS[a]}>
            <dt className="flex items-baseline justify-between gap-2 text-[12.5px] text-bone-2">
              <span className="truncate">{AXIS_SHORT[a]}</span>
              <span className="font-mono text-[12px] text-bone tabular-nums">{Math.round(plan.weights[a] * 100)}%</span>
            </dt>
            <dd>
              <Bar value={plan.weights[a] * 100} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-10 pt-2" role="status" aria-busy="true" aria-label="Loading the channel plan">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-11 w-[min(100%,640px)]" />
        <Skeleton className="h-5 w-[min(100%,900px)]" />
        <Skeleton className="h-5 w-[min(80%,700px)]" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="glass-flat flex flex-col">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-5 border-line border-b px-6 py-5 last:border-b-0">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
