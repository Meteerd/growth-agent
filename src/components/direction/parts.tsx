import { Badge } from "@/components/ui/Badge";
import { sourceHue } from "@/components/ui/EvidenceCard";
import {
  type ChannelMode,
  type ChannelScores,
  type ChannelWeights,
  type Evidence,
  SCORE_AXES,
  SCORE_AXIS_LABELS,
  type ScoreAxis,
} from "@/contracts";
import { cn } from "@/lib/client/cn";
import { SOURCE_LABELS } from "@/lib/client/format";
import { evidenceStat } from "./rank";

export const AXIS_SHORT: Record<ScoreAxis, string> = {
  audience: "Audience",
  provenWins: "Proven wins",
  productionFit: "Production",
  complianceRisk: "Compliance",
  speedToSignal: "Speed",
  modelFit: "Model fit",
};

export const MODE_TEXT: Record<ChannelMode, string> = { organic: "Organic", paid: "Paid", both: "Organic + paid" };

export function ModeBadge({ mode, className }: { mode: ChannelMode; className?: string }) {
  return (
    <Badge tone={mode === "organic" ? "cyan" : mode === "paid" ? "violet" : "neutral"} className={className}>
      {MODE_TEXT[mode]}
    </Badge>
  );
}

/** A flat 0 to 100 bar: rule-coloured track, ink fill. */
export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block h-[3px] w-full bg-raised-2", className)}>
      <span className="absolute inset-y-0 left-0 bg-bone" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  );
}

/** Score in mono over a thin bar on the absolute 0 to 100 scale. */
export function ScoreBar({ score, size = "md", className }: { score: number; size?: "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="flex items-baseline gap-1 font-mono tabular-nums leading-none">
        <span className={cn("text-bone", size === "lg" ? "text-[34px] tracking-[-0.02em]" : "text-[19px]")}>
          {Math.round(score)}
        </span>
        <span className="text-[11px] text-bone-3">/100</span>
      </p>
      <Bar value={score} />
    </div>
  );
}

/** The six axes as a small table of horizontal bars: axis, bar, score, weight. */
export function AxisBars({
  scores,
  weights,
  className,
}: {
  scores: ChannelScores;
  weights: ChannelWeights;
  className?: string;
}) {
  return (
    <table data-testid="axis-bars" className={cn("w-full border-collapse text-ui", className)}>
      <caption className="sr-only">Scores on the six axes, 0 to 100, with each axis weight</caption>
      <thead>
        <tr className="border-line border-b text-left">
          <th scope="col" className="mono-label pb-2 font-semibold">
            Axis
          </th>
          <th scope="col" className="pb-2">
            <span className="sr-only">Bar</span>
          </th>
          <th scope="col" className="mono-label pb-2 text-right font-semibold">
            Score
          </th>
          <th scope="col" className="mono-label pb-2 pl-4 text-right font-semibold">
            Weight
          </th>
        </tr>
      </thead>
      <tbody>
        {SCORE_AXES.map((a) => (
          <tr key={a} data-axis={a} className="border-line-faint border-b last:border-b-0">
            <th
              scope="row"
              className="w-[96px] py-2 pr-3 text-left font-normal text-bone-2"
              title={SCORE_AXIS_LABELS[a]}
            >
              {AXIS_SHORT[a]}
            </th>
            <td className="py-2">
              <Bar value={scores[a]} className="h-1.5" />
            </td>
            <td className="w-10 py-2 text-right font-mono text-bone tabular-nums">{scores[a]}</td>
            <td className="w-14 py-2 pl-4 text-right font-mono text-bone-3 tabular-nums">
              {Math.round(weights[a] * 100)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A small evidence thumbnail: the real thumbnail when we have one, else a muted tile with the source name. */
export function EvidenceTile({ evidence, className }: { evidence?: Evidence; className?: string }) {
  const base = "relative h-11 w-[52px] shrink-0 overflow-hidden rounded-card border border-line bg-raised-2";
  if (evidence?.thumbnailUrl)
    // biome-ignore lint/performance/noImgElement: evidence thumbnails come from arbitrary hosts
    return <img src={evidence.thumbnailUrl} alt="" loading="lazy" className={cn(base, "object-cover", className)} />;
  const stat = evidence && evidenceStat(evidence);
  return (
    <span aria-hidden className={cn(base, "flex flex-col justify-between px-1 pt-1.5 pb-1 text-left", className)}>
      {evidence && (
        <>
          <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: sourceHue(evidence.source) }} />
          <span className="line-clamp-2 font-semibold text-[9px] text-bone-2 leading-[1.1]">
            {SOURCE_LABELS[evidence.source]}
          </span>
          {stat && <span className="font-mono text-[10px] text-bone tabular-nums leading-none">{stat}</span>}
        </>
      )}
    </span>
  );
}

export function ArrowGlyph({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", dir === "down" && "rotate-180")} fill="none" aria-hidden>
      <path d="M8 13V3.5M3.8 7.5 8 3.3l4.2 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
