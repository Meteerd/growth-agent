"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/client/format";
import { formatElapsed, linePath, nearestIndex, type Point, scale } from "./chart";

// Geometry (px). The axis band is inside the fixed height, so labels never overflow the cell.
const H = 156;
const AXIS = 22;
const PAD_X = 8;
const PAD_TOP = 20;
const BASE = H - AXIS;
const LINE = "var(--color-cyan)"; // teal: a flat print tone, no fill under the line

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Views over time for one posted pack. xMax / yMax come from the whole grid so every small multiple shares
 * one scale. Points are real snapshots; the line between them is only a join, never an estimate.
 */
export function ViewsChart({
  points,
  xMax,
  yMax,
  label,
}: {
  points: Point[];
  xMax: number;
  yMax: number;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const x = scale(0, xMax, PAD_X, Math.max(PAD_X, width - PAD_X));
  const y = scale(0, yMax, BASE, PAD_TOP);
  const pts = points.map((p) => ({ ...p, x: x(p.t), y: y(p.v) }));
  const a = active == null ? null : pts[Math.min(active, pts.length - 1)];
  const first = points[0];
  const last = points.at(-1);
  const summary = last
    ? points.length === 1
      ? `${label}: one snapshot, ${formatCount(last.v)} views, ${formatElapsed(last.t)} after posting.`
      : `${label}: ${points.length} snapshots, views rose from ${formatCount(first.v)} to ${formatCount(last.v)} over ${formatElapsed(last.t - first.t)}.`
    : `${label}: no view counts yet.`;

  const step = (d: number) => setActive((i) => Math.max(0, Math.min(pts.length - 1, (i ?? pts.length - 1) + d)));

  return (
    <div className="relative">
      <div
        ref={box}
        data-testid="views-chart"
        data-points={points.length}
        role="slider"
        tabIndex={0}
        aria-label={`${label} views by snapshot. Arrow keys step through snapshots.`}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, points.length)}
        aria-valuenow={(active ?? points.length - 1) + 1}
        aria-valuetext={a ? `${formatCount(a.v)} views, ${formatElapsed(a.t)} after posting` : summary}
        className="relative h-[156px] touch-pan-y rounded-cell outline-offset-4"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setActive(
            nearestIndex(
              pts.map((p) => p.x),
              e.clientX - r.left,
            ),
          );
        }}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(pts.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -1e9, End: 1e9 }[e.key];
          if (d == null) return;
          e.preventDefault();
          step(d);
        }}
      >
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={summary} className="block overflow-visible">
            {[yMax, yMax / 2, 0].map((v) => (
              <g key={v}>
                <line
                  x1={0}
                  x2={width}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? "var(--color-line-strong)" : "var(--color-line)"}
                />
                {v > 0 && (
                  <text x={0} y={y(v) - 6} className="fill-bone-3 font-mono text-[10px] tabular-nums">
                    {formatCount(v)}
                  </text>
                )}
              </g>
            ))}
            {[0, 0.5, 1].map((f) => (
              <text
                key={f}
                x={f === 0 ? 0 : f === 1 ? width : width / 2}
                y={H - 5}
                textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                className="fill-bone-3 font-mono text-[10px] tabular-nums"
              >
                {f === 0 ? "posted" : `+${formatElapsed(xMax * f)}`}
              </text>
            ))}
            {pts.length > 1 && (
              <path
                d={linePath(pts)}
                fill="none"
                stroke={LINE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* the current marker is a playhead: the one place record red appears on this chart */}
            {a && <line x1={a.x} x2={a.x} y1={PAD_TOP - 8} y2={BASE} stroke="var(--color-signal)" strokeWidth={1} />}
            {pts.map((p) => (
              <circle
                key={p.id}
                data-testid="chart-point"
                cx={p.x}
                cy={p.y}
                r={a?.id === p.id ? 5 : 3.5}
                fill={LINE}
                stroke="var(--color-raised)"
                strokeWidth={2}
                style={{ transition: "r 140ms var(--ease-out)" }}
              />
            ))}
          </svg>
        )}
      </div>
      {a && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[4px] border border-line bg-raised px-2.5 py-1.5 shadow-[0_6px_24px_rgb(17_17_17/0.12)]"
          style={{
            left: Math.min(Math.max(a.x, 64), Math.max(64, width - 64)),
            top: a.y < 64 ? a.y + 14 : a.y - 12,
            transform: a.y < 64 ? "translateX(-50%)" : "translate(-50%, -100%)",
          }}
        >
          <p className="font-mono text-bone text-ui tabular-nums">{formatCount(a.v)} views</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-bone-3 tabular-nums">
            {when.format(new Date(a.at))}, +{formatElapsed(a.t)}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Captured</th>
            <th scope="col">After posting</th>
            <th scope="col">Views</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <td>{p.at}</td>
              <td>{formatElapsed(p.t)}</td>
              <td>{formatCount(p.v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
