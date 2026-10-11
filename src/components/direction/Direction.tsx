"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useRunCtx } from "@/components/run/RunContext";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { type Channel, type ChannelPlan, SCORE_AXES, SCORE_AXIS_LABELS } from "@/contracts";
import { useBrand, useEvidence, usePlan } from "@/lib/client/queries";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { firstSentence } from "./geometry";
import { OrbitView } from "./Orbit";
import { AXIS_SHORT, pad2 } from "./parts";
import { RankedList } from "./RankedList";

const EASE = [0.22, 1, 0.36, 1] as const;
type View = "orbit" | "list";

export function Direction() {
  const { runId, events, revealed, connection } = useRunCtx();
  const plan = usePlan(runId);
  const evidence = useEvidence(runId);
  const { data: brand } = useBrand(plan.data?.brandId);
  const [view, setView] = useState<View>("orbit");
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
          className="mx-auto mt-6 max-w-2xl"
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
  const evidenceCount = (c: Channel) =>
    (p.channels.find((x) => x.channel === c) ?? p.notNow.find((x) => x.channel === c))?.evidenceIds.length ?? 0;
  const open = (c: Channel) => setDrawer({ channel: c, open: true });

  return (
    <MotionConfig reducedMotion="user">
      <div data-testid="direction" className="grid gap-8 xl:grid-cols-[296px_minmax(0,1fr)] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-7 xl:sticky xl:top-48 xl:self-start">
          <PlanHead plan={p} />
          <Weights plan={p} />
        </div>
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as View)}
          items={[
            { value: "orbit", label: "Orbit" },
            { value: "list", label: "Ranked list" },
          ]}
          className="flex min-w-0 flex-col items-start gap-4"
        >
          <TabPanel value="orbit" data-testid="view-orbit" className="w-full outline-none">
            <OrbitView plan={p} brand={brand} evidenceCount={evidenceCount} onOpen={open} />
          </TabPanel>
          <TabPanel value="list" data-testid="view-list" className="w-full outline-none">
            <RankedList plan={p} runId={runId} evidenceCount={evidenceCount} onOpen={open} />
          </TabPanel>
        </Tabs>
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
  const lead = firstSentence(plan.summary);
  const rest = plan.summary.trim().slice(lead.length).trim();
  return (
    <header className="flex flex-col gap-4">
      <motion.p
        className="mono-label flex flex-wrap items-center gap-x-3 gap-y-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <span>Channel plan</span>
        <motion.span
          key={plan.version}
          data-testid="plan-version"
          initial={{ opacity: 0.4, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="inline-flex h-6 items-center rounded-chip px-2.5 font-mono text-[11px] text-bone tabular-nums normal-case shadow[inset_0_0_0_1px_var(--color-line-strong)]"
        >
          v{plan.version}
        </motion.span>
        <span className="text-bone-3 tabular-nums">
          {pad2(plan.channels.length)} channels / {pad2(plan.notNow.length)} not now
        </span>
      </motion.p>
      <h1 className="mask-line max-w-[40ch] font-display text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.1] tracking-[-0.01em] xl:text-[27px] xl:leading-[1.14]">
        <span>{lead}</span>
      </h1>
      {rest && (
        <motion.p
          className="max-w-[78ch] text-bone-2 text-ui leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {rest}
        </motion.p>
      )}
    </header>
  );
}

function Weights({ plan }: { plan: ChannelPlan }) {
  const max = Math.max(...SCORE_AXES.map((a) => plan.weights[a]), 0.0001);
  return (
    <section
      aria-labelledby="weights-h"
      data-testid="plan-weights"
      className="flex w-full flex-col gap-4 border-line border-t pt-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="weights-h" className="mono-label">
          Weights
        </h2>
        <p className="font-mono text-[10.5px] text-bone-3">score = weighted sum of six axes</p>
      </header>
      <dl className="grid grid-cols-3 gap-x-5 gap-y-4 md:grid-cols-6 xl:grid-cols-2">
        {SCORE_AXES.map((a, i) => (
          <div key={a} className="flex min-w-0 flex-col gap-1.5" title={SCORE_AXIS_LABELS[a]}>
            <dt className="flex items-baseline justify-between gap-2 font-mono text-[10.5px] text-bone-3 uppercase tracking-[0.06em]">
              <span className="truncate">{AXIS_SHORT[a]}</span>
              <span className="text-bone normal-case tabular-nums tracking-normal">
                {Math.round(plan.weights[a] * 100)}%
              </span>
            </dt>
            <dd aria-hidden className="relative h-[3px] overflow-hidden rounded-cell bg-line">
              <motion.span
                className="absolute inset-y-0 left-0 block w-full origin-left rounded-cell bg-bone/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: plan.weights[a] / max }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.04, ease: EASE }}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true" aria-label="Loading the channel plan">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-[min(100%,720px)]" />
        <Skeleton className="h-9 w-[min(80%,520px)]" />
      </div>
      <Skeleton className="h-8 w-56 rounded-chip" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid place-items-center rounded-panel p-8 hairline">
          <Skeleton className="aspect-square w-full max-w-[560px] rounded-full" />
        </div>
        <Skeleton className="h-[520px] rounded-panel" />
      </div>
    </div>
  );
}
