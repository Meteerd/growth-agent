"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { CHANNEL_LABELS, type Channel, type ChannelPlan, type Evidence, type PatchPlanRequest } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { qk, useAction } from "@/lib/client/queries";
import { ArrowGlyph, EvidenceTile, ModeBadge, ScoreBar } from "./parts";
import { firstSentence, moveItem, notNowReason, pad2 } from "./rank";

// Desktop columns: rank, channel, score, why, evidence, first steps, actions. Below xl each row is a stacked card.
const COLS = "xl:grid-cols-[36px_164px_100px_minmax(0,1.3fr)_192px_minmax(0,1fr)_128px]";

/** Click anywhere on a row to open its drawer; buttons inside the row keep their own action. */
const rowClick = (open: () => void) => (e: React.MouseEvent) => {
  if (!(e.target as HTMLElement).closest("button, a, input")) open();
};

/** The ranked table and the Not now list. Reorder and drop write a new plan version through PATCH /plan. */
export function RankedList({
  plan,
  runId,
  evidence,
  onOpen,
}: {
  plan: ChannelPlan;
  runId: string;
  evidence?: Evidence[];
  onOpen: (c: Channel) => void;
}) {
  const recs = [...plan.channels].sort((a, b) => a.priority - b.priority);
  const byId = new Map((evidence ?? []).map((e) => [e.id, e]));
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
    <div className="flex flex-col gap-14">
      <section aria-labelledby="ranked-h" data-testid="ranked-list" className="flex flex-col gap-4">
        <SectionHead id="ranked-h" title="Ranked channels">
          Open a row for the full brief and the evidence behind it.
        </SectionHead>
        {recs.length === 0 ? (
          <p className="rounded-panel border border-line border-dashed px-6 py-10 text-center text-bone-2 text-ui">
            Every channel was dropped. They are under Not now with your reasons.
          </p>
        ) : (
          <div className="glass-flat overflow-hidden">
            <div aria-hidden className={cn("hidden border-line border-b px-6 py-3 xl:grid xl:gap-x-5", COLS)}>
              {["Rank", "Channel", "Score", "Why", "Evidence", "First steps"].map((h) => (
                <span key={h} className="mono-label">
                  {h}
                </span>
              ))}
              <span className="mono-label text-right">Edit</span>
            </div>
            <ol>
              {recs.map((c, i) => {
                const label = CHANNEL_LABELS[c.channel];
                const ids = c.evidenceIds;
                // the channel name button is the keyboard path; a row click is a mouse shortcut
                return (
                  <motion.li
                    key={c.channel}
                    layout="position"
                    transition={{ layout: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}
                    data-testid={`rank-row-${c.channel}`}
                    data-priority={c.priority}
                    onClick={rowClick(() => onOpen(c.channel))}
                    className={cn(
                      "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 border-line border-b bg-raised px-4 py-5",
                      "transition-colors duration-150 last:border-b-0 hover:bg-glass-strong md:px-6 xl:gap-x-5 xl:gap-y-0 xl:py-4",
                      COLS,
                    )}
                  >
                    <span className="font-mono text-[15px] text-bone-3 tabular-nums leading-[1.5]">
                      <span className="sr-only">Priority </span>
                      {pad2(c.priority)}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 xl:flex-col xl:items-start">
                      <button
                        type="button"
                        onClick={() => onOpen(c.channel)}
                        data-testid={`rank-open-${c.channel}`}
                        className="text-left font-semibold text-[17px] text-bone leading-snug tracking-[-0.01em] underline-offset-4 hover:underline"
                      >
                        {label}
                      </button>
                      <ModeBadge mode={c.mode} />
                    </div>
                    <ScoreBar score={c.score} className="w-16 pt-0.5 xl:w-full xl:max-w-24" />
                    <p
                      className="col-span-3 line-clamp-3 text-bone-2 text-ui leading-[1.45] xl:col-span-1 xl:line-clamp-2"
                      title={c.rationale}
                    >
                      {firstSentence(c.rationale)}
                    </p>
                    <div className="col-span-3 xl:col-span-1">
                      <p className="mono-label mb-2 xl:sr-only">Evidence</p>
                      <button
                        type="button"
                        onClick={() => onOpen(c.channel)}
                        data-testid={`rank-evidence-${c.channel}`}
                        aria-label={`Evidence for ${label}, ${ids.length} ${ids.length === 1 ? "item" : "items"}`}
                        className="group flex items-center gap-1.5 rounded-card"
                      >
                        {ids.slice(0, 3).map((id) => (
                          <EvidenceTile
                            key={id}
                            evidence={byId.get(id)}
                            className="transition-colors duration-150 group-hover:border-bone-4"
                          />
                        ))}
                        {ids.length > 3 && (
                          <span className="pl-1 font-mono text-[11px] text-bone-3 tabular-nums">+{ids.length - 3}</span>
                        )}
                        {ids.length === 0 && <span className="text-bone-3 text-ui">None linked</span>}
                      </button>
                    </div>
                    <div className="col-span-3 min-w-0 xl:col-span-1">
                      <p className="mono-label mb-2 xl:sr-only">First steps</p>
                      <ol className="flex flex-col gap-1">
                        {c.firstSteps.slice(0, 2).map((s, k) => (
                          <li key={s} className="flex min-w-0 gap-2 text-bone text-ui leading-[1.45]" title={s}>
                            <span className="font-mono text-[11px] text-bone-3 tabular-nums leading-[1.75]">
                              {k + 1}
                            </span>
                            <span className="min-w-0 xl:truncate">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="col-span-3 flex items-center gap-1.5 xl:col-span-1 xl:justify-end">
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
                        aria-label={`Drop ${label}`}
                        data-testid={`rank-drop-${c.channel}`}
                        disabled={locked}
                        onClick={() => askDrop(c.channel)}
                      >
                        Drop
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <NotNowList plan={plan} onOpen={onOpen} />

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
              className="h-11 w-full min-w-0 rounded-card border border-line-strong bg-raised px-3.5 text-bone text-ui outline-none transition-colors duration-150 placeholder:text-bone-4 hover:border-bone-4 focus:border-bone"
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

function NotNowList({ plan, onOpen }: { plan: ChannelPlan; onOpen: (c: Channel) => void }) {
  const scoreOf = new Map((plan.considered ?? []).map((c) => [c.channel, c.score]));
  return (
    <section aria-labelledby="notnow-h" data-testid="notnow-list" className="flex flex-col gap-4">
      <SectionHead id="notnow-h" title="Not now">
        Where the plan does not go, and why. Open a row for the evidence that ruled it out.
      </SectionHead>
      {plan.notNow.length === 0 ? (
        <p className="border-line border-t pt-4 text-bone-3 text-ui">Nothing was ruled out for this brand.</p>
      ) : (
        <ul className="border-line border-t">
          {plan.notNow.map((n) => {
            const label = CHANNEL_LABELS[n.channel];
            const score = scoreOf.get(n.channel);
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the Evidence button is the keyboard path; a row click is a mouse shortcut
              <li
                key={n.channel}
                data-testid={`notnow-row-${n.channel}`}
                onClick={rowClick(() => onOpen(n.channel))}
                // xl: the reason column lines up with the table's Why column
                className="grid cursor-pointer gap-x-8 gap-y-2 border-line border-b px-4 py-4 transition-colors duration-150 hover:bg-raised md:grid-cols-[176px_minmax(0,1fr)_auto] md:items-baseline md:px-6 xl:grid-cols-[340px_minmax(0,1fr)_auto] xl:gap-x-5"
              >
                <p className="flex items-baseline gap-2.5">
                  <s className="font-medium text-body text-bone-2 line-through decoration-bone-3">{label}</s>
                  {score != null && (
                    <span
                      className="font-mono text-[11px] text-bone-3 tabular-nums"
                      title="Weighted score before it was ruled out"
                    >
                      {score}/100
                    </span>
                  )}
                </p>
                <p className="min-w-0 max-w-[78ch] break-words text-bone text-ui leading-relaxed">
                  {notNowReason(n.channel, n.reason)}
                </p>
                <Button
                  size="sm"
                  variant="quiet"
                  className="-ml-2 justify-self-start px-2 md:-mr-2 md:ml-0 md:justify-self-end"
                  onClick={() => onOpen(n.channel)}
                  aria-label={`Evidence for not using ${label}, ${n.evidenceIds.length} items`}
                >
                  Evidence
                  <span className="font-mono text-[12px] text-bone-3 tabular-nums">{n.evidenceIds.length}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SectionHead({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-6">
      <h2 id={id} className="font-display text-[26px] leading-none md:text-[28px]">
        {title}
      </h2>
      <p className="text-bone-2 text-ui">{children}</p>
    </header>
  );
}
