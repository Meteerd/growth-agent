"use client";

import type { Evidence, EvidenceSource } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { formatCount, longevity, SOURCE_LABELS } from "@/lib/client/format";
import { Badge, DemoBadge } from "./Badge";

// Each source gets a fixed hue from the spectral ramp + status colours, so the wall groups by colour at a glance.
const SOURCE_HUE: Partial<Record<EvidenceSource, string>> = {
  website: "#ECE7DD",
  meta_ad_library: "#5B3CFF",
  meta_ads: "#5B3CFF",
  spiral: "#8C6BFF",
  tiktok: "#3CE0FF",
  instagram: "#FF5C7A",
  youtube: "#FF7A5C",
  reddit: "#FFC85C",
  google_maps: "#7CFFB2",
  app_store: "#9FD8FF",
  play_store: "#9FD8FF",
  trustpilot: "#7CFFB2",
  manus_research: "#D4FF3A",
  revenuecat: "#FFC85C",
  posthog: "#FFC85C",
  stripe: "#8C6BFF",
  paddle: "#8C6BFF",
};
export const sourceHue = (s: EvidenceSource) => SOURCE_HUE[s] ?? "#ECE7DD";

/** Designed stand-in when there is no thumbnail (third-party media is never re-hosted). */
export function SourceArt({
  source,
  kind,
  label,
  className,
}: {
  source: EvidenceSource;
  kind: string;
  label?: string;
  className?: string;
}) {
  const hue = sourceHue(source);
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 0%, ${hue}26, transparent 60%), linear-gradient(180deg, #12151c, #0a0c10)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{ backgroundImage: `repeating-linear-gradient(115deg, ${hue}1f 0 1px, transparent 1px 9px)` }}
      />
      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between">
        <span className="font-serif text-[22px] italic leading-none" style={{ color: hue }}>
          {label ?? kind}
        </span>
        <span className="font-mono text-[9px] text-bone-3 uppercase tracking-[0.08em]">no media kept</span>
      </div>
    </div>
  );
}

export function EvidenceCard({
  evidence: e,
  expanded,
  onToggle,
  onOpenBlueprint,
  className,
}: {
  evidence: Evidence;
  expanded?: boolean;
  onToggle?: () => void;
  onOpenBlueprint?: () => void;
  className?: string;
}) {
  const m = e.metrics;
  const tier = longevity(m.daysRunning);
  const outlier = m.outlierScore != null && m.outlierScore >= 2;
  const d = e.deconstruction;
  const hue = sourceHue(e.source);
  return (
    <article
      data-source={e.source}
      className={cn(
        "glass-flat group relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel-strong)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${hue}, transparent)` }}
      />
      {e.thumbnailUrl ? (
        // biome-ignore lint/performance/noImgElement: evidence thumbnails come from arbitrary hosts
        <img src={e.thumbnailUrl} alt="" className="h-28 w-full object-cover" loading="lazy" />
      ) : (
        <SourceArt source={e.source} kind={e.kind} className="h-24" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: hue }} />
          <span className="mono-label truncate">
            {SOURCE_LABELS[e.source]} / {e.kind}
          </span>
          {e.demo && <DemoBadge label="Demo" className="ml-auto h-5 px-2 text-[9.5px]" />}
        </div>
        <h4 className="line-clamp-2 text-bone text-ui leading-snug">{e.title}</h4>
        {e.author && <p className="-mt-2 truncate font-mono text-[11px] text-bone-3">{e.author}</p>}
        <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          {m.views != null && <Metric k="views" v={formatCount(m.views)} />}
          {m.daysRunning != null && <Metric k="running" v={`${m.daysRunning} d`} />}
          {m.rating != null && <Metric k="rating" v={m.rating.toFixed(1)} />}
          {m.likes != null && m.views == null && <Metric k="likes" v={formatCount(m.likes)} />}
        </dl>
        {(tier || outlier) && (
          <div className="flex flex-wrap gap-1.5">
            {outlier && <Badge tone="signal">{m.outlierScore!.toFixed(1)}x outlier</Badge>}
            {tier === "proven" && <Badge tone="pass">Proven 30d+</Badge>}
            {tier === "testing" && <Badge tone="warn">Testing</Badge>}
          </div>
        )}
        {d && (
          <>
            <button
              onClick={onToggle}
              aria-expanded={!!expanded}
              className="flex items-center justify-between rounded-[8px] px-0 text-left font-mono text-[11px] text-bone-2 transition-colors hover:text-bone"
            >
              <span>{expanded ? "Hide deconstruction" : "Deconstruct"}</span>
              <span aria-hidden className={cn("transition-transform duration-300", expanded && "rotate-45")}>
                +
              </span>
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-400 ease-out",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <dl className="flex flex-col gap-2 border-line border-t pt-3 text-[12px]">
                  {d.hook && <Row k="hook" v={`"${d.hook}"`} serif />}
                  {d.format && <Row k="format" v={d.format} />}
                  {d.angle && <Row k="angle" v={d.angle} />}
                  {d.cta && <Row k="cta" v={d.cta} />}
                  {d.beats && d.beats.length > 0 && (
                    <div>
                      <dt className="mono-label">beats</dt>
                      <dd className="mt-1 flex flex-col gap-0.5">
                        {d.beats.map((b) => (
                          <span key={b.t} className="flex gap-2 text-bone-2">
                            <span className="w-8 shrink-0 font-mono text-bone-3">{b.t}s</span>
                            {b.what}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
                {onOpenBlueprint && (
                  <button onClick={onOpenBlueprint} className="mt-3 font-mono text-[11px] text-signal hover:underline">
                    Open the blueprint
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-bone-3">{k}</dt>
      <dd className="text-bone">{v}</dd>
    </div>
  );
}
function Row({ k, v, serif }: { k: string; v: string; serif?: boolean }) {
  return (
    <div>
      <dt className="mono-label">{k}</dt>
      <dd className={cn("mt-0.5 text-bone-2", serif && "font-serif text-[15px] text-bone italic")}>{v}</dd>
    </div>
  );
}
