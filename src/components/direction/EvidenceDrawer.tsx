"use client";

import { useState } from "react";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { Sheet } from "@/components/ui/Overlay";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { CHANNEL_LABELS, type Channel, type ChannelPlan, type Evidence } from "@/contracts";
import { MODE_HUE, MODE_TEXT, ModeBadge, notNowReason, pad2, Radar, ScoreBar } from "./parts";

/** Evidence drawer for one channel: the full recommendation (or the not-now reason) and the evidence behind it. */
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
  evidence: { data?: Evidence[]; isLoading: boolean; error: unknown; refetch: () => void };
}) {
  const rec = channel ? plan.channels.find((c) => c.channel === channel) : undefined;
  const nn = channel && !rec ? plan.notNow.find((n) => n.channel === channel) : undefined;
  const ids = rec?.evidenceIds ?? nn?.evidenceIds ?? [];
  const label = channel ? CHANNEL_LABELS[channel] : "";
  return (
    <Sheet
      open={open && !!channel}
      onOpenChange={onOpenChange}
      title={label}
      label={rec ? `Priority ${pad2(rec.priority)} / ${MODE_TEXT[rec.mode].toLowerCase()}` : "Not now"}
    >
      <div data-testid="evidence-drawer" data-channel={channel ?? undefined} className="flex flex-col gap-7">
        {rec ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <ScoreBar score={rec.score} hue={MODE_HUE[rec.mode]} className="w-40" />
              <ModeBadge mode={rec.mode} />
            </div>
            <Radar
              scores={rec.scores}
              hue={MODE_HUE[rec.mode]}
              drawKey={`drawer-${rec.channel}`}
              className="mx-auto w-full max-w-[260px]"
              title={`${label} scores on six axes`}
            />
            <Block label="Why">
              <p className="text-bone text-body leading-relaxed">{rec.rationale}</p>
            </Block>
            <div className="grid gap-6 sm:grid-cols-2">
              <Block label="Formats">
                <Chips items={rec.formats} />
              </Block>
              <Block label="Cadence">
                <p className="font-mono text-[12px] text-bone-2 leading-relaxed">{rec.cadence}</p>
              </Block>
            </div>
            <Block label="First steps">
              <ol className="flex flex-col gap-2.5">
                {rec.firstSteps.slice(0, 3).map((s, i) => (
                  <li key={s} className="flex gap-3 text-bone text-ui">
                    <span className="mt-px font-mono text-[11px] text-bone-3 tabular-nums">{pad2(i + 1)}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Block>
            <Block label="KPIs">
              <ul className="flex flex-col gap-1.5">
                {rec.kpis.map((k) => (
                  <li key={k} className="flex gap-3 text-bone-2 text-ui">
                    <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-bone-3" />
                    {k}
                  </li>
                ))}
              </ul>
            </Block>
            {rec.targets.length > 0 && (
              <Block label="Targets">
                <Chips items={rec.targets} mono />
              </Block>
            )}
          </>
        ) : nn ? (
          <Block label="Why not now">
            <p className="font-display text-[22px] text-bone leading-snug">{notNowReason(nn.channel, nn.reason)}</p>
          </Block>
        ) : null}

        <Block label={`Evidence / ${ids.length}`}>
          <EvidenceList ids={ids} evidence={evidence} />
        </Block>
      </div>
    </Sheet>
  );
}

function EvidenceList({
  ids,
  evidence,
}: {
  ids: string[];
  evidence: { data?: Evidence[]; isLoading: boolean; error: unknown; refetch: () => void };
}) {
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
        <p className="font-mono text-[11px] text-bone-3">
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

function Chips({ items, mono }: { items: string[]; mono?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li
          key={t}
          className={
            mono
              ? "rounded-chip px-2.5 py-1 font-mono text-[11px] text-bone-2 shadow[inset_0_0_0_1px_var(--color-line-strong)]"
              : "rounded-chip bg-glass px-3 py-1 text-[12px] text-bone shadow[inset_0_0_0_1px_var(--color-line)]"
          }
        >
          {t}
        </li>
      ))}
    </ul>
  );
}
