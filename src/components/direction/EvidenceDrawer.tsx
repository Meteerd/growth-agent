"use client";

import { useState } from "react";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { Sheet } from "@/components/ui/Overlay";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { CHANNEL_LABELS, type Channel, type ChannelPlan, type Evidence } from "@/contracts";
import { AxisBars, MODE_TEXT, ModeBadge, ScoreBar } from "./parts";
import { notNowReason, pad2 } from "./rank";

type EvidenceQuery = { data?: Evidence[]; isLoading: boolean; error: unknown; refetch: () => void };

/** Drawer for one channel: the full recommendation (or the not-now reason) and the evidence behind it. */
export function EvidenceDrawer({
  plan,
  channel,
  open,
  onOpenChange,
  evidence,
}: {
  plan: ChannelPlan;
  channel: Channel | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  evidence: EvidenceQuery;
}) {
  const rec = channel ? plan.channels.find((c) => c.channel === channel) : undefined;
  const nn = channel && !rec ? plan.notNow.find((n) => n.channel === channel) : undefined;
  const scored = !rec && channel ? plan.considered?.find((c) => c.channel === channel) : undefined;
  const ids = rec?.evidenceIds ?? nn?.evidenceIds ?? [];
  return (
    <Sheet
      open={open && !!channel}
      onOpenChange={onOpenChange}
      title={channel ? CHANNEL_LABELS[channel] : ""}
      label={rec ? `Priority ${pad2(rec.priority)} / ${MODE_TEXT[rec.mode]}` : "Not now"}
    >
      <div data-testid="evidence-drawer" data-channel={channel ?? undefined} className="flex flex-col gap-7">
        {rec ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <ScoreBar score={rec.score} size="lg" className="w-40" />
              <ModeBadge mode={rec.mode} />
            </div>
            <Block label="Six axes">
              <AxisBars scores={rec.scores} weights={plan.weights} />
            </Block>
            <Block label="Why">
              <p className="text-bone text-body leading-relaxed">{rec.rationale}</p>
            </Block>
            <div className="grid-cols-1 grid gap-6 sm:grid-cols-2">
              <Block label="Formats">
                <Chips items={rec.formats} />
              </Block>
              <Block label="Cadence">
                <p className="text-bone text-ui leading-relaxed">{rec.cadence}</p>
              </Block>
            </div>
            <Block label="First steps">
              <ol className="flex flex-col gap-2.5">
                {rec.firstSteps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-bone text-ui leading-relaxed">
                    <span className="font-mono text-[11px] text-bone-3 tabular-nums leading-[1.9]">{pad2(i + 1)}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Block>
            <Block label="KPIs">
              <ul className="flex flex-col gap-1.5">
                {rec.kpis.map((k) => (
                  <li key={k} className="flex gap-3 text-bone-2 text-ui">
                    <span aria-hidden className="mt-[8px] h-px w-2 shrink-0 bg-bone-3" />
                    {k}
                  </li>
                ))}
              </ul>
            </Block>
            {rec.targets.length > 0 && (
              <Block label="Targets">
                <Chips items={rec.targets} />
              </Block>
            )}
          </>
        ) : nn ? (
          <>
            <Block label="Why not now">
              <p className="text-[17px] text-bone leading-relaxed">{notNowReason(nn.channel, nn.reason)}</p>
            </Block>
            {scored && (
              <Block label={`Scored ${scored.score} before it was ruled out`}>
                <AxisBars scores={scored.scores} weights={plan.weights} />
              </Block>
            )}
          </>
        ) : null}

        <Block label={`Evidence / ${ids.length}`}>
          <EvidenceList ids={ids} evidence={evidence} />
        </Block>
      </div>
    </Sheet>
  );
}

function EvidenceList({ ids, evidence }: { ids: string[]; evidence: EvidenceQuery }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!ids.length) return <p className="text-bone-3 text-ui">No evidence is linked. This was an operator decision.</p>;
  if (evidence.error)
    return <ErrorState title="Could not load the evidence" error={evidence.error} onRetry={evidence.refetch} />;
  if (evidence.isLoading) return <SkeletonCard lines={2} />;
  const byId = new Map((evidence.data ?? []).map((e) => [e.id, e]));
  const found = ids.flatMap((id) => byId.get(id) ?? []);
  const missing = ids.length - found.length;
  return (
    <div className="flex flex-col gap-3">
      {found.map((e) => (
        <EvidenceCard
          key={e.id}
          evidence={e}
          expanded={expanded === e.id}
          onToggle={() => setExpanded((x) => (x === e.id ? null : e.id))}
        />
      ))}
      {missing > 0 && (
        <p className="text-bone-3 text-ui">
          {missing} linked {missing === 1 ? "item is" : "items are"} not in this run's evidence yet.
        </p>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="mono-label">{label}</h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className="rounded-card border border-line bg-raised-2 px-2 py-0.5 text-[12px] text-bone">
          {t}
        </li>
      ))}
    </ul>
  );
}
