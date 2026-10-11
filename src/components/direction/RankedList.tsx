"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { CHANNEL_LABELS, type Channel, type ChannelPlan, type PatchPlanRequest, SCORE_AXES } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { qk, useAction } from "@/lib/client/queries";
import { moveItem } from "./geometry";
import { ArrowGlyph, AXIS_ABBR, AxisBars, MODE_HUE, ModeBadge, notNowReason, pad2, ScoreBar } from "./parts";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Ranked list: reorder and drop write a new plan version through PATCH /plan. */
export function RankedList({
  plan,
  runId,
  evidenceCount,
  onOpen,
}: {
  plan: ChannelPlan;
  runId: string;
  evidenceCount: (c: Channel) => number;
  onOpen: (c: Channel) => void;
}) {
  const recs = [...plan.channels].sort((a, b) => a.priority - b.priority);
  const [busy, setBusy] = useState<string | null>(null);
  const [dropFor, setDropFor] = useState<Channel | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dropError, setDropError] = useState<string>();
  const inputId = useId();
  const action = useAction(
    (req: PatchPlanRequest) => getClient().patchPlan(runId, req),
    () => [qk.plan(runId)],
  );
  const locked = action.isPending;

  const move = (i: number, dir: -1 | 1) => {
    if (locked) return; // double-submit guard
    const c = recs[i];
    setBusy(`${dir < 0 ? "up" : "down"}-${c.channel}`);
    action.mutate(
      {
        channels: moveItem(
          recs.map((r) => r.channel),
          i,
          i + dir,
        ),
      },
      {
        onSuccess: (p) =>
          toast({
            title: `Plan updated to v${p.version}`,
            body: `${CHANNEL_LABELS[c.channel]} is now priority ${i + dir + 1}.`,
            tone: "pass",
          }),
        onError: (e) => toast({ title: "The order was not saved", body: e.message, tone: "fail" }),
        onSettled: () => setBusy(null),
      },
    );
  };

  const askDrop = (c: Channel) => {
    setDropFor(c);
    setReason("");
    setDropError(undefined);
    setDropOpen(true);
  };
  const submitDrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || !dropFor) return;
    const c = dropFor;
    setBusy(`drop-${c}`);
    action.mutate(
      { drop: [{ channel: c, reason: reason.trim() || undefined }] },
      {
        onSuccess: (p) => {
          setDropOpen(false);
          toast({
            title: `Plan updated to v${p.version}`,
            body: `${CHANNEL_LABELS[c]} moved to Not now.`,
            tone: "pass",
          });
        },
        onError: (err) => setDropError(err.message || "Could not drop the channel. Try again."),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="ranked-h" data-testid="ranked-list">
        <h2 id="ranked-h" className="sr-only">
          Recommended channels in priority order
        </h2>
        {recs.length === 0 ? (
          <p className="rounded-panel border border-line border-dashed px-6 py-10 text-center text-bone-2 text-ui">
            Every channel was dropped. The plan keeps them under Not now with your reasons.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {recs.map((c, i) => {
              const label = CHANNEL_LABELS[c.channel];
              const hue = MODE_HUE[c.mode];
              return (
                <motion.li
                  key={c.channel}
                  layout="position"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: i * 0.05,
                    ease: EASE,
                    layout: { type: "spring", stiffness: 380, damping: 36 },
                  }}
                  data-testid={`rank-row-${c.channel}`}
                  data-priority={c.priority}
                  className="glass-flat relative grid gap-6 overflow-hidden p-5 md:grid-cols-[minmax(0,1fr)_272px] md:gap-10 md:p-6"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-4 left-0 w-px"
                    style={{ background: `linear-gradient(180deg, transparent, ${hue}, transparent)` }}
                  />
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                      <span className="font-mono text-[13px] text-bone-3 tabular-nums">{pad2(c.priority)}</span>
                      <h3 className="font-serif text-[30px] leading-none md:text-[34px]">{label}</h3>
                      <ModeBadge mode={c.mode} className="self-center" />
                    </div>
                    <p className="max-w-[74ch] text-bone-2 text-ui leading-relaxed">{c.rationale}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px]">
                      <span className="text-bone-3 uppercase tracking-[0.08em]">cadence</span>
                      <span className="text-bone-2">{c.cadence}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-5 md:border-line md:border-l md:pl-8">
                    <div className="flex items-end justify-between gap-6">
                      <ScoreBar score={c.score} hue={hue} className="w-24" />
                      <AxisBars scores={c.scores} hue={hue} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        className="w-8 px-0"
                        aria-label={`Move ${label} up`}
                        data-testid={`rank-up-${c.channel}`}
                        disabled={i === 0 || locked}
                        loading={busy === `up-${c.channel}`}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowGlyph dir="up" />
                      </Button>
                      <Button
                        size="sm"
                        className="w-8 px-0"
                        aria-label={`Move ${label} down`}
                        data-testid={`rank-down-${c.channel}`}
                        disabled={i === recs.length - 1 || locked}
                        loading={busy === `down-${c.channel}`}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowGlyph dir="down" />
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => onOpen(c.channel)}
                        data-testid={`rank-evidence-${c.channel}`}
                      >
                        Evidence
                        <span className="font-mono text-[11px] text-bone-3 tabular-nums">
                          {evidenceCount(c.channel)}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-auto"
                        data-testid={`rank-drop-${c.channel}`}
                        disabled={locked}
                        onClick={() => askDrop(c.channel)}
                      >
                        Drop
                      </Button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </section>

      <NotNowList plan={plan} evidenceCount={evidenceCount} onOpen={onOpen} />
      {plan.considered && plan.considered.length > 0 && <Considered plan={plan} />}

      <Dialog
        open={dropOpen}
        onOpenChange={(o) => {
          if (!locked) setDropOpen(o);
        }}
        title={dropFor ? `Drop ${CHANNEL_LABELS[dropFor]}?` : "Drop channel"}
        description="It moves to Not now and the plan gets a new version. Your reason is kept with it."
      >
        <form onSubmit={submitDrop} className="flex flex-col gap-4" data-testid="drop-form">
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="mono-label">
              Reason (optional)
            </label>
            <input
              id={inputId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={240}
              placeholder="For example: nobody can film this month"
              aria-invalid={!!dropError || undefined}
              className={cn(
                "h-11 w-full min-w-0 rounded-card bg-[rgb(255_255_255/0.03)] px-3.5 text-bone text-ui outline-none",
                "shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 placeholder:text-bone-4",
                "hover:shadow-[inset_0_0_0_1px_rgb(236_231_221/0.22)] focus-visible:outline-none",
                "focus:shadow-[inset_0_0_0_1px_rgb(212_255_58/0.65),0_0_0_3px_rgb(212_255_58/0.12)]",
              )}
            />
          </div>
          {dropError && (
            <p role="alert" className="text-fail text-ui">
              {dropError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="quiet" onClick={() => setDropOpen(false)} disabled={locked}>
              Keep it
            </Button>
            <Button type="submit" variant="danger" loading={locked} data-testid="drop-confirm">
              Drop channel
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function NotNowList({
  plan,
  evidenceCount,
  onOpen,
}: {
  plan: ChannelPlan;
  evidenceCount: (c: Channel) => number;
  onOpen: (c: Channel) => void;
}) {
  const scoreOf = new Map((plan.considered ?? []).map((c) => [c.channel, c.score]));
  return (
    <section
      aria-labelledby="notnow-h"
      data-testid="notnow-list"
      className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10"
    >
      <header className="lg:sticky lg:top-48 lg:self-start">
        <h2 id="notnow-h" className="font-serif text-[36px] leading-none">
          Not now
        </h2>
        <p className="mt-3 max-w-[36ch] text-bone-2 text-ui">
          Where the plan does not go, and why. Each reason links to the evidence that ruled it out.
        </p>
      </header>
      {plan.notNow.length === 0 ? (
        <p className="text-bone-3 text-ui">Nothing was ruled out for this brand.</p>
      ) : (
        <ul className="flex flex-col border-line border-t">
          {plan.notNow.map((n, i) => (
            <motion.li
              key={n.channel}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: EASE }}
              data-testid={`notnow-row-${n.channel}`}
              className="grid gap-3 border-line border-b py-5 md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-8"
            >
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className="relative top-[3px] size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(236_231_221/0.3)]"
                >
                  <span className="absolute top-1/2 left-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-bone-3" />
                </span>
                <span className="font-medium text-body text-bone">{CHANNEL_LABELS[n.channel]}</span>
                {scoreOf.has(n.channel) && (
                  <span
                    className="font-mono text-[11px] text-bone-3 tabular-nums"
                    title="Weighted score before it was ruled out"
                  >
                    {scoreOf.get(n.channel)}
                  </span>
                )}
              </div>
              <p className="max-w-[80ch] text-bone-2 text-ui leading-relaxed">{notNowReason(n.channel, n.reason)}</p>
              <Button
                size="sm"
                variant="quiet"
                className="justify-self-start md:justify-self-end"
                onClick={() => onOpen(n.channel)}
                aria-label={`Evidence for not using ${CHANNEL_LABELS[n.channel]}`}
              >
                Evidence
                <span className="font-mono text-[11px] text-bone-3 tabular-nums">{evidenceCount(n.channel)}</span>
              </Button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Considered({ plan }: { plan: ChannelPlan }) {
  const rows = [...(plan.considered ?? [])].sort((a, b) => b.score - a.score);
  const pick = new Map(plan.channels.map((c) => [c.channel, c.priority]));
  const out = new Set(plan.notNow.map((n) => n.channel));
  return (
    <section aria-labelledby="considered-h" className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <header>
        <h2 id="considered-h" className="font-serif text-[28px] leading-none">
          Every channel scored
        </h2>
        <p className="mt-3 max-w-[36ch] text-bone-2 text-ui">
          The score is the weighted sum of the six axes. Weights sit under each column.
        </p>
      </header>
      <div data-lenis-prevent className="min-w-0 overflow-x-auto rounded-panel hairline">
        <table className="w-full min-w-[620px] border-collapse font-mono text-[12px] tabular-nums">
          <thead>
            <tr className="border-line border-b text-left">
              <th scope="col" className="px-4 py-3 font-normal text-bone-3">
                <span className="mono-label">channel</span>
              </th>
              {SCORE_AXES.map((a) => (
                <th key={a} scope="col" className="px-2 py-3 text-right font-normal">
                  <span className="mono-label block">{AXIS_ABBR[a]}</span>
                  <span className="block text-[10px] text-bone-3">{Math.round(plan.weights[a] * 100)}%</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-normal">
                <span className="mono-label">score</span>
              </th>
              <th scope="col" className="px-4 py-3 text-right font-normal">
                <span className="mono-label">verdict</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = pick.get(r.channel);
              return (
                <tr key={r.channel} className={cn("border-line border-b last:border-b-0", !p && "text-bone-3")}>
                  <th scope="row" className="px-4 py-2.5 text-left font-sans font-normal text-[13px] text-bone">
                    {CHANNEL_LABELS[r.channel]}
                  </th>
                  {SCORE_AXES.map((a) => (
                    <td key={a} className="px-2 py-2.5 text-right text-bone-2">
                      {r.scores[a]}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-bone">{r.score}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p ? (
                      <span className="text-bone">P{p}</span>
                    ) : out.has(r.channel) ? (
                      <span className="text-bone-3">not now</span>
                    ) : (
                      <span className="text-bone-4">scored</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
