"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { NumberTicker } from "@/components/ui/NumberTicker";
import type { Blueprint, Review, Shot } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";
import { nearestFrame, scoreTone, shotScore } from "./align";

const TONE_TEXT = { pass: "text-pass", warn: "text-warn", fail: "text-fail" } as const;

/** A frame from the analysed video when this machine has it; otherwise a designed card that describes the shot. */
export function ShotFrame({
  url,
  fallback,
  purpose,
  className,
  reference,
}: {
  url?: string;
  fallback: string;
  purpose: Blueprint["shots"][number]["purpose"];
  className?: string;
  reference?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const hue = PURPOSE_COLOR[purpose];
  return (
    <div className={cn("relative overflow-hidden bg-raised", className)}>
      {url && !broken ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: frames and keyframes come from the engine asset route */}
          <img
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setBroken(true)}
            loading="lazy"
          />
          {reference && (
            <span className="absolute top-1.5 left-1.5 rounded-[4px] bg-ink/70 px-1 font-mono text-[8.5px] text-bone-2 uppercase tracking-[0.06em]">
              ref
            </span>
          )}
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center p-2.5"
          style={{
            background: `repeating-linear-gradient(115deg, ${hue}18 0 1px, transparent 1px 8px), radial-gradient(120% 80% at 0% 0%, ${hue}22, transparent 60%), #0c0e13`,
          }}
        >
          <p className="line-clamp-4 font-serif text-[13px] text-bone-2 italic leading-snug">{fallback}</p>
        </div>
      )}
    </div>
  );
}

export function Timeline({
  bp,
  aligned,
  keyframes,
  references,
  review,
  t,
  onScrub,
  scanning,
}: {
  bp: Blueprint;
  aligned: (Shot | undefined)[];
  keyframes: Map<number, string>;
  references: string[];
  review?: Review;
  t: number;
  onScrub: (t: number) => void;
  scanning: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const D = bp.durationSec;
  const active = bp.shots.findIndex((s) => t >= s.t0 && t < s.t1);
  const activeIdx = active === -1 ? bp.shots.length - 1 : active;
  const pct = (x: number) => `${(x / D) * 100}%`;
  const ticks = Array.from({ length: Math.floor(D) + 1 }, (_, i) => i);

  const fromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    onScrub(Math.max(0, Math.min(D - 0.001, ((clientX - r.left) / r.width) * D)));
  };
  const step = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(bp.shots.length - 1, activeIdx + dir));
    onScrub(bp.shots[next].t0 + 0.001);
  };

  return (
    <div className="overflow-x-auto" data-lenis-prevent>
      <div className="min-w-[780px]">
        <div className="grid grid-cols-[112px_1fr] gap-x-4">
          {/* ruler */}
          <div />
          <div className="relative h-11">
            {ticks.map((s) => (
              <span key={s} className="absolute bottom-0 h-full" style={{ left: pct(s) }}>
                <span className={cn("absolute bottom-0 w-px bg-line-strong", s % 2 === 0 ? "h-2.5" : "h-1.5")} />
                {s % 2 === 0 && (
                  <span className="absolute bottom-3 -translate-x-1/2 font-mono text-[9.5px] text-bone-3">{s}s</span>
                )}
              </span>
            ))}
            <span className="absolute bottom-0 h-full" style={{ left: pct(bp.hook.endSec) }}>
              <span className="absolute top-0 left-1 whitespace-nowrap rounded-[4px] bg-signal-dim px-1 font-mono text-[9px] text-signal">
                hook ends {bp.hook.endSec}s
              </span>
              <span className="absolute inset-y-0 w-px border-signal/50 border-l border-dashed" />
            </span>
          </div>

          {/* rows + scan line share one positioned track */}
          <div className="flex flex-col justify-around py-1">
            <RowLabel title="The winner" sub={`${bp.shots.length} shots, ${D}s`} />
            <div className="h-8" />
            <RowLabel
              title="Our remake"
              sub={aligned.filter(Boolean).length ? "aligned shot for shot" : "not produced yet"}
            />
          </div>
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label="Timeline position"
            aria-valuemin={0}
            aria-valuemax={D}
            aria-valuenow={Math.round(t * 10) / 10}
            aria-valuetext={`${t.toFixed(1)} seconds, shot ${activeIdx + 1}: ${PURPOSE_LABEL[bp.shots[activeIdx].purpose]}`}
            data-testid="timeline"
            className="relative cursor-ew-resize select-none touch-none rounded-card outline-offset-4"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) fromPointer(e.clientX);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                step(1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                step(-1);
              } else if (e.key === "Home") onScrub(0);
              else if (e.key === "End") onScrub(D - 0.001);
            }}
          >
            {/* winner */}
            <div className="relative h-[138px]">
              {bp.shots.map((s, i) => {
                const frame = nearestFrame(bp.frames, s.t0, s.t1);
                const on = i === activeIdx;
                return (
                  <motion.div
                    key={s.idx}
                    data-testid={`bp-shot-${i}`}
                    data-active={on || undefined}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: on ? 1 : 0.62, y: 0 }}
                    transition={{ duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-y-0 px-[2px]"
                    style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
                  >
                    <div
                      className={cn("relative h-full overflow-hidden rounded-[8px] transition-shadow duration-300")}
                      style={{
                        boxShadow: on
                          ? `0 0 0 1px ${PURPOSE_COLOR[s.purpose]}, 0 12px 40px -12px ${PURPOSE_COLOR[s.purpose]}66`
                          : "inset 0 0 0 1px rgb(236 231 221 / 0.08)",
                      }}
                    >
                      <ShotFrame
                        url={frame?.url}
                        fallback={`${s.subject}: ${s.action}`}
                        purpose={s.purpose}
                        className="h-full w-full"
                      />
                      <span
                        className="absolute inset-x-0 top-0 h-[3px]"
                        style={{ background: PURPOSE_COLOR[s.purpose] }}
                      />
                      <span
                        className="absolute top-2 left-2 rounded-[4px] bg-ink/75 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em]"
                        style={{ color: PURPOSE_COLOR[s.purpose] }}
                      >
                        {PURPOSE_LABEL[s.purpose]}
                      </span>
                      {s.onScreenText && (
                        <span className="absolute inset-x-2 bottom-2 line-clamp-2 rounded-[4px] bg-ink/70 px-1.5 py-1 text-[11px] text-bone leading-tight">
                          {s.onScreenText}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* alignment threads */}
            <svg className="block h-8 w-full" viewBox={`0 0 ${D * 100} 40`} preserveAspectRatio="none" aria-hidden>
              {bp.shots.map((s, i) => {
                const x = ((s.t0 + s.t1) / 2) * 100;
                const on = i === activeIdx;
                return (
                  <g key={s.idx}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={40}
                      stroke={on ? PURPOSE_COLOR[s.purpose] : "rgb(236 231 221 / 0.14)"}
                      strokeWidth={on ? 2 : 1}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={aligned[i] ? undefined : "3 4"}
                    />
                    <circle
                      cx={x}
                      cy={20}
                      r={on ? 3.5 : 2}
                      fill={on ? PURPOSE_COLOR[s.purpose] : "rgb(236 231 221 / 0.3)"}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>

            {/* remake */}
            <div className="relative h-[138px]">
              {bp.shots.map((s, i) => {
                const ours = aligned[i];
                const on = i === activeIdx;
                const kf = ours ? keyframes.get(ours.idx) : undefined;
                const ref = !kf && references.length ? references[i % references.length] : undefined;
                const sc = shotScore(review, ours?.idx);
                return (
                  <motion.div
                    key={s.idx}
                    data-testid={`remake-shot-${i}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: ours ? (on ? 1 : 0.62) : 0.35, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.25 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-y-0 px-[2px]"
                    style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
                  >
                    {ours ? (
                      <div
                        className="relative h-full overflow-hidden rounded-[8px] transition-shadow duration-300"
                        style={{
                          boxShadow: on
                            ? "0 0 0 1px var(--color-signal), 0 12px 40px -12px rgb(212 255 58 / 0.45)"
                            : "inset 0 0 0 1px rgb(236 231 221 / 0.1)",
                        }}
                      >
                        <ShotFrame
                          url={kf ?? ref}
                          reference={!kf && !!ref}
                          fallback={ours.visualPrompt}
                          purpose={s.purpose}
                          className="h-full w-full"
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 h-[3px]"
                          style={{ background: PURPOSE_COLOR[s.purpose] }}
                        />
                        {sc && (
                          <span
                            title={sc.issues.join("; ") || "No issues found"}
                            className={cn(
                              "absolute top-2 right-2 rounded-[4px] bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                              TONE_TEXT[scoreTone(sc.score)],
                            )}
                            data-testid={`remake-score-${i}`}
                          >
                            <NumberTicker value={sc.score} from={0} duration={1.2} />
                          </span>
                        )}
                        {ours.onScreenText && (
                          <span className="absolute inset-x-2 bottom-2.5 line-clamp-2 rounded-[4px] bg-ink/70 px-1.5 py-1 text-[11px] text-bone leading-tight">
                            {ours.onScreenText}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center rounded-[8px] border border-line border-dashed font-mono text-[10px] text-bone-4">
                        no shot
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* scan line */}
            <div className="pointer-events-none absolute -top-1 -bottom-1 z-10" style={{ left: pct(t) }} aria-hidden>
              <span className="absolute inset-y-0 -left-px w-[2px] bg-signal shadow-[0_0_18px_3px_rgb(212_255_58/0.55)]" />
              <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-signal px-1.5 py-0.5 font-mono text-[10px] text-ink tabular-nums">
                {scanning ? "watching " : ""}
                {t.toFixed(1)}s
              </span>
              {scanning && (
                <span className="absolute inset-y-0 right-0 w-24 bg-[linear-gradient(90deg,transparent,rgb(212_255_58/0.10))]" />
              )}
            </div>
          </div>
        </div>
        {/* legend */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[128px]">
          {Object.entries(PURPOSE_LABEL).map(([k, v]) => (
            <span
              key={k}
              className="flex items-center gap-1.5 font-mono text-[10px] text-bone-3 uppercase tracking-[0.06em]"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: PURPOSE_COLOR[k as keyof typeof PURPOSE_COLOR] }}
              />
              {v}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10px] text-bone-3">drag, click, or use the arrow keys</span>
        </div>
      </div>
    </div>
  );
}

function RowLabel({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex h-[138px] flex-col justify-center">
      <p className="font-serif text-[20px] leading-tight">{title}</p>
      <p className="mt-1 font-mono text-[10px] text-bone-3">{sub}</p>
    </div>
  );
}
