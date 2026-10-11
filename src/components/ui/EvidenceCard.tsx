"use client";

import type { Evidence, EvidenceSource } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { formatCount, longevity, SOURCE_LABELS } from "@/lib/client/format";
import { Badge, DemoBadge } from "./Badge";

// Each source gets a fixed hue from the spectral ramp + status colours, so the wall groups by colour at a glance.
const SOURCE_HUE: Partial<Record<EvidenceSource, string>> = {
  website: "#5C5C5C",
  meta_ad_library: "#3B5B8C",
  meta_ads: "#3B5B8C",
  spiral: "#6B4E71",
  tiktok: "#2E6F73",
  instagram: "#A6402B",
  youtube: "#C46A2A",
  reddit: "#B7791F",
  google_maps: "#6F7A35",
  app_store: "#5B6B7A",
  play_store: "#5B6B7A",
  trustpilot: "#1F7A4D",
  manus_research: "#111111",
  revenuecat: "#8C6D1F",
  posthog: "#8C6D1F",
  stripe: "#4F4A8C",
  paddle: "#4F4A8C",
};
export const sourceHue = (s: EvidenceSource) => SOURCE_HUE[s] ?? "#5C5C5C";

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
      style={{ background: "var(--color-raised-2)" }}
    >
      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between">
        <span className="font-display text-[18px] leading-none text-bone-2">{label ?? kind}</span>
        <span className="text-[10.5px] text-bone-3">no media kept</span>
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
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: hue }} />
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
              className="flex items-center justify-between rounded-[4px] px-0 text-left text-[12px] text-bone-2 transition-colors hover:text-bone"
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
                  <button
                    onClick={onOpenBlueprint}
                    className="mt-3 text-[12px] text-bone underline decoration-bone-4 underline-offset-4"
                  >
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
      <dd className={cn("mt-0.5 text-bone-2", serif && "font-display text-[15px] text-bone")}>{v}</dd>
    </div>
  );
}
