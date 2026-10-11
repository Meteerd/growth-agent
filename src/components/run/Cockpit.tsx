"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EvidenceCard, sourceHue } from "@/components/ui/EvidenceCard";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Panel } from "@/components/ui/Panel";
import { PhaseRail } from "@/components/ui/PhaseRail";
import { Skeleton } from "@/components/ui/Skeleton";
import { type Evidence, type EvidenceSource, PHASES, type Phase, type RunEvent } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { useFieldActivity } from "@/lib/client/field";
import { clock, PHASE_LABELS, SOURCE_LABELS } from "@/lib/client/format";
import { PURPOSE_COLOR } from "@/lib/client/purpose";
import { useBlueprints, useEvidence } from "@/lib/client/queries";
import { EventRow } from "./EventRow";
import { useRunCtx } from "./RunContext";

const RAIL = PHASES.filter((p) => p !== "measure");

export function Cockpit() {
  const ctx = useRunCtx();
  const { liveStatus, livePhase, events, completed } = ctx;
  useFieldActivity(liveStatus === "running" ? 0.6 : liveStatus === "waiting_input" ? 0.35 : 0.2);
  const notes = usePhaseNotes(events);
  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_minmax(0,380px)]">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-44 lg:self-start">
          <Panel tone="flat" className="hidden p-5 lg:block">
            <p className="mono-label mb-3">phases</p>
            <PhaseRail phases={RAIL} current={livePhase} status={liveStatus} completed={completed} notes={notes} />
          </Panel>
          <PhaseRail
            className="lg:hidden"
            orientation="horizontal"
            phases={RAIL}
            current={livePhase}
            status={liveStatus}
            completed={completed}
          />
          <RunActions />
        </aside>
        <section aria-label="Evidence" className="flex min-w-0 flex-col gap-4">
          <NextStep />
          <Blueprints />
          <EvidenceWall />
        </section>
        <EventStream />
      </div>
    </MotionConfig>
  );
}

function usePhaseNotes(events: RunEvent[]) {
  return useMemo(() => {
    const n = (t: RunEvent["type"]) => events.filter((e) => e.type === t).length;
    const notes: Partial<Record<Phase, string>> = {};
    if (n("evidence")) notes.research = `${n("evidence")} found`;
    if (n("blueprint")) notes.reverse_engineer = `${n("blueprint")} ads`;
    if (n("question")) notes.consult = `${n("question")} asked`;
    if (n("plan")) notes.direction = "plan ready";
    if (n("concept")) notes.production = `${n("concept")} concepts`;
    if (n("review")) notes.review = `${n("review")} reviews`;
    if (n("compliance")) notes.compliance = `${n("compliance")} checks`;
    if (n("pack")) notes.pack = `${n("pack")} packs`;
    return notes;
  }, [events]);
}

function RunActions() {
  const { liveStatus, replay, ended, events } = useRunCtx();
  const done = ended || liveStatus === "done";
  return (
    <Panel tone="hairline" className="flex flex-col gap-3 p-4">
      <p className="mono-label">run</p>
      <p className="font-mono text-[12px] text-bone-2">
        {events.length} events
        {events[0] ? ` / ${clock(Date.parse(events.at(-1)!.ts) - Date.parse(events[0].ts)).slice(0, 5)}` : ""}
      </p>
      {done && (
        <Button size="sm" onClick={() => replay(250)} data-testid="replay">
          Replay the run
        </Button>
      )}
    </Panel>
  );
}

function NextStep() {
  const { liveStatus, runId, events, ended } = useRunCtx();
  const questions = events.filter((e) => e.type === "question").length;
  const packs = events.filter((e) => e.type === "pack").length;
  const hasPlan = events.some((e) => e.type === "plan");
  let body: React.ReactNode = null;
  if (liveStatus === "waiting_input")
    body = (
      <Banner
        tone="warn"
        testId="needs-you"
        title={`The agent has ${questions || "a few"} questions for you.`}
        href={`/runs/${runId}/consult`}
        cta="Start the consultation"
      >
        Only what the data could not answer. The run waits until you answer or skip.
      </Banner>
    );
  else if (ended || liveStatus === "done")
    body = (
      <Banner
        tone="pass"
        testId="run-done"
        title={`Run complete. ${packs} packs ready to post.`}
        href={`/runs/${runId}/packs`}
        cta="Open the packs"
      >
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            className="underline decoration-bone-4 underline-offset-4 hover:text-bone"
            href={`/runs/${runId}/direction`}
          >
            Where to go
          </Link>
          <Link
            className="underline decoration-bone-4 underline-offset-4 hover:text-bone"
            href={`/runs/${runId}/studio`}
          >
            The content
          </Link>
        </span>
      </Banner>
    );
  else if (hasPlan)
    body = (
      <Banner
        tone="signal"
        title="Direction is decided. Production is running."
        href={`/runs/${runId}/direction`}
        cta="See where to go"
      >
        Channels ranked with evidence, and the ones to skip with reasons.
      </Banner>
    );
  return body;
}

function Banner({
  tone,
  title,
  href,
  cta,
  children,
  testId,
}: {
  tone: "warn" | "pass" | "signal";
  title: string;
  href: string;
  cta: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-testid={testId}
      className={cn(
        "glass flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between",
        tone === "warn" && "shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(255_200_92/0.35)]",
        tone === "pass" && "shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(124_255_178/0.25)]",
        tone === "signal" && "shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(212_255_58/0.3)]",
      )}
    >
      <div>
        <p className="font-serif text-[24px] leading-tight">{title}</p>
        {children && <div className="mt-1 text-bone-2 text-ui">{children}</div>}
      </div>
      <Button variant="primary" asChild>
        <Link href={href}>{cta}</Link>
      </Button>
    </motion.div>
  );
}

function Blueprints() {
  const { runId, revealed } = useRunCtx();
  const { data } = useBlueprints(runId);
  const list = (data ?? []).filter((b) => revealed.has(b.id));
  if (!list.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="mono-label">winning videos taken apart</p>
        <span className="font-mono text-[11px] text-bone-3">{list.length} blueprints</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: i * 0.05 }}
          >
            <Link
              href={`/runs/${runId}/blueprints/${b.id}`}
              data-testid={`blueprint-${b.id}`}
              className="glass-flat group flex flex-col gap-3 p-4 transition-shadow duration-300 hover:shadow-[var(--shadow-panel-strong)]"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge tone="signal">Blueprint</Badge>
                <span className="font-mono text-[11px] text-bone-3">
                  {b.shots.length} shots / {b.durationSec}s / {b.structure.replaceAll("_", " ")}
                </span>
              </div>
              <p className="line-clamp-2 font-serif text-[19px] italic leading-snug">
                &ldquo;{b.hook.spoken ?? b.hook.onScreenText ?? b.hook.visual}&rdquo;
              </p>
              <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                {b.shots.map((s) => (
                  <span key={s.idx} style={{ flex: `${s.t1 - s.t0} 1 0`, background: PURPOSE_COLOR[s.purpose] }} />
                ))}
              </div>
              <span className="font-mono text-[11px] text-bone-2 transition-colors group-hover:text-signal">
                Open the side-by-side remake
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EvidenceWall() {
  const { runId, revealed, events } = useRunCtx();
  const { data, isLoading } = useEvidence(runId);
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => (data ?? []).filter((e) => revealed.has(e.id)), [data, revealed]);
  // groups in the order their first card landed
  const groups = useMemo(() => {
    const order: EvidenceSource[] = [];
    for (const e of events) {
      const src = (e.data as { source?: EvidenceSource } | undefined)?.source;
      if (e.type === "evidence" && src && !order.includes(src)) order.push(src);
    }
    const by = new Map<EvidenceSource, Evidence[]>();
    for (const e of shown) by.set(e.source, [...(by.get(e.source) ?? []), e]);
    const keys = [...order.filter((s) => by.has(s)), ...[...by.keys()].filter((s) => !order.includes(s))];
    return keys.map((k) => [k, by.get(k)!] as const);
  }, [shown, events]);
  const outliers = shown.filter((e) => (e.metrics.outlierScore ?? 0) >= 2).length;
  const proven = shown.filter((e) => (e.metrics.daysRunning ?? 0) >= 30).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-line sm:grid-cols-4">
        {[
          ["evidence", shown.length],
          ["sources", groups.length],
          ["outliers 2x+", outliers],
          ["proven ads 30d+", proven],
        ].map(([k, v]) => (
          <div key={k} className="bg-raised/90 px-4 py-3">
            <p className="mono-label">{k}</p>
            <p className="mt-1 text-heading">
              <NumberTicker value={v as number} duration={0.5} />
            </p>
          </div>
        ))}
      </div>
      {isLoading && !groups.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-panel" />
          ))}
        </div>
      ) : !groups.length ? (
        <Panel
          tone="hairline"
          className="grid min-h-[240px] place-items-center p-8 text-center"
          data-testid="wall-empty"
        >
          <div>
            <p className="font-serif text-[22px] italic text-bone-2">The wall fills as evidence is found.</p>
            <p className="mt-2 font-mono text-[11px] text-bone-3">
              Sites, winning ads and posts, communities, reviews, your own numbers.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6" data-testid="evidence-wall">
          {groups.map(([source, items]) => (
            <div key={source}>
              <div className="mb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: sourceHue(source) }} />
                <p className="mono-label">{SOURCE_LABELS[source]}</p>
                <span className="font-mono text-[11px] text-bone-3">{items.length}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {items.map((e, i) => (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -28, scale: 0.94, rotate: -1.2 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24, delay: Math.min(i, 8) * 0.04 }}
                  >
                    <EvidenceCard
                      evidence={e}
                      expanded={open === e.id}
                      onToggle={() => setOpen(open === e.id ? null : e.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventStream() {
  const { events } = useRunCtx();
  const ref = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const t0 = events[0] ? Date.parse(events[0].ts) : 0;
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });
  return (
    <aside aria-label="Event stream" className="min-w-0 lg:sticky lg:top-44 lg:self-start">
      <Panel className="flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-line border-b px-4 py-3">
          <span className="mono-label">live / agent stream</span>
          <span className="font-mono text-[11px] text-bone-3">{events.length}</span>
        </header>
        <ol
          ref={ref}
          data-lenis-prevent
          aria-live="polite"
          aria-relevant="additions"
          data-testid="event-stream"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="h-[46vh] overflow-y-auto overscroll-contain py-2 lg:h-[calc(100vh-15rem)]"
        >
          {events.length === 0 && (
            <li className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] text-bone-3">
              <span className="size-1.5 animate-pulse rounded-full bg-signal" /> connecting to the run
            </li>
          )}
          {events.slice(-300).map((e, i, arr) => (
            <EventRow key={e.id} e={e} fresh={i >= arr.length - 3} t={clock(Date.parse(e.ts) - t0).slice(0, 5)} />
          ))}
        </ol>
        <footer className="border-line border-t px-4 py-2.5 font-mono text-[10.5px] text-bone-3">
          {PHASE_LABELS[events.at(-1)?.phase ?? "intake"]} / tool calls, costs and warnings as they happen
        </footer>
      </Panel>
    </aside>
  );
}
