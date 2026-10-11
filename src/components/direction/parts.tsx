"use client";

import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import {
  CHANNEL_LABELS,
  type Channel,
  type ChannelMode,
  type ChannelScores,
  SCORE_AXES,
  SCORE_AXIS_LABELS,
  type ScoreAxis,
} from "@/contracts";
import { cn } from "@/lib/client/cn";
import { polar, radarAngle, radarPoints, toPath } from "./geometry";

export const AXIS_SHORT: Record<ScoreAxis, string> = {
  audience: "Audience",
  provenWins: "Proven wins",
  productionFit: "Production",
  complianceRisk: "Compliance",
  speedToSignal: "Speed",
  modelFit: "Model fit",
};
export const AXIS_ABBR: Record<ScoreAxis, string> = {
  audience: "AUD",
  provenWins: "WIN",
  productionFit: "PRD",
  complianceRisk: "CMP",
  speedToSignal: "SPD",
  modelFit: "FIT",
};

/** Mode hue: organic cyan, paid violet, both bone. Not-now bodies use bone-3. */
export const MODE_HUE: Record<ChannelMode, string> = { organic: "#3CE0FF", paid: "#8C6BFF", both: "#ECE7DD" };
export const MODE_TEXT: Record<ChannelMode, string> = { organic: "Organic", paid: "Paid", both: "Organic + paid" };
export const NOT_NOW_HUE = "rgb(17 17 17 / 0.5)";

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The mock and engine prefix operator drops with the channel label; the row already shows it. */
export function notNowReason(channel: Channel, reason: string) {
  const prefix = `${CHANNEL_LABELS[channel]}: `;
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason;
}

export function ModeBadge({ mode, className }: { mode: ChannelMode; className?: string }) {
  return (
    <Badge tone={mode === "organic" ? "cyan" : mode === "paid" ? "violet" : "neutral"} className={className}>
      {MODE_TEXT[mode]}
    </Badge>
  );
}

/** Score in mono with a hairline bar under it. */
export function ScoreBar({ score, hue = "#ECE7DD", className }: { score: number; hue?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="flex items-baseline gap-1 font-mono tabular-nums leading-none">
        <span className="text-[30px] text-bone tracking-[-0.02em]">{Math.round(score)}</span>
        <span className="text-[11px] text-bone-3">/100</span>
      </p>
      <span aria-hidden className="relative block h-px w-full bg-line-strong">
        <span
          className="absolute inset-y-0 left-0 h-px origin-left"
          style={{ width: `${score}%`, background: hue, boxShadow: `0 0 8px ${hue}` }}
        />
      </span>
    </div>
  );
}

/** Six vertical mini bars, one per axis, values in the accessible text and the tooltip. */
export function AxisBars({
  scores,
  hue = "#ECE7DD",
  className,
}: {
  scores: ChannelScores;
  hue?: string;
  className?: string;
}) {
  return (
    <dl className={cn("flex items-end gap-2.5", className)}>
      {SCORE_AXES.map((a) => (
        <div key={a} className="flex flex-col items-center gap-1.5" title={`${SCORE_AXIS_LABELS[a]}: ${scores[a]}`}>
          <dt className="order-2 font-mono text-[9px] text-bone-3 tracking-[0.06em]">
            <span aria-hidden>{AXIS_ABBR[a]}</span>
            <span className="sr-only">{SCORE_AXIS_LABELS[a]}</span>
          </dt>
          <dd className="order-1 flex flex-col items-center gap-1.5">
            <span className="font-mono text-[10px] text-bone-2 tabular-nums leading-none">{scores[a]}</span>
            <span aria-hidden className="relative block h-7 w-[5px] overflow-hidden rounded-cell bg-line">
              <span
                className="absolute inset-x-0 bottom-0 rounded-cell"
                style={{ height: `${scores[a]}%`, background: hue, opacity: 0.35 + (scores[a] / 100) * 0.6 }}
              />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const RC = 150;
const R = 76;
const C = { x: RC, y: RC };
const RINGS = [0.25, 0.5, 0.75, 1];

/** Six-axis radar: hairline hexagon, polygon drawn in 300 ms whenever `drawKey` changes. */
export function Radar({
  scores,
  hue,
  drawKey,
  className,
  title,
}: {
  scores: ChannelScores;
  hue: string;
  drawKey: string;
  className?: string;
  title: string;
}) {
  const reduce = useReducedMotion();
  const pts = radarPoints(scores, R, C);
  const hex = (f: number) => toPath(SCORE_AXES.map((_, i) => polar(R * f, radarAngle(i), C)));
  return (
    <svg viewBox="0 28 300 244" className={cn("overflow-visible", className)} role="img" aria-label={title}>
      {RINGS.map((f) => (
        <path
          key={f}
          d={hex(f)}
          fill="none"
          stroke={f === 1 ? "rgb(17 17 17 / 0.16)" : "rgb(17 17 17 / 0.07)"}
          strokeWidth="1"
        />
      ))}
      {SCORE_AXES.map((a, i) => {
        const p = polar(R, radarAngle(i), C);
        return <line key={a} x1={RC} y1={RC} x2={p.x} y2={p.y} stroke="rgb(17 17 17 / 0.07)" strokeWidth="1" />;
      })}
      <motion.path
        key={drawKey}
        d={toPath(pts)}
        fill={hue}
        stroke={hue}
        strokeWidth="1.25"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 0.14 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: `drop-shadow(0 0 10px ${hue}55)` }}
      />
      {pts.map((p, i) => (
        <circle key={`${drawKey}-${SCORE_AXES[i]}`} cx={p.x} cy={p.y} r="2.2" fill={hue} />
      ))}
      {SCORE_AXES.map((a, i) => {
        const th = radarAngle(i);
        const p = polar(R + 18, th, C);
        const cos = Math.cos(th);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const top = Math.sin(th) < -0.9;
        const bottom = Math.sin(th) > 0.9;
        const y = top ? p.y - 14 : bottom ? p.y + 6 : p.y - 4;
        return (
          <text key={a} x={p.x} y={y} textAnchor={anchor} className="font-mono">
            <tspan x={p.x} fontSize="8.5" letterSpacing="0.08em" fill="rgb(17 17 17 / 0.5)">
              {AXIS_SHORT[a].toUpperCase()}
            </tspan>
            <tspan x={p.x} dy="13" fontSize="12" fill="#ECE7DD">
              {scores[a]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

export function ArrowGlyph({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", dir === "down" && "rotate-180")} fill="none" aria-hidden>
      <path d="M8 13V3.5M3.8 7.5 8 3.3l4.2 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
