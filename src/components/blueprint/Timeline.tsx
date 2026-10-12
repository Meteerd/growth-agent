"use client";

import { useRef, useState } from "react";
import type { Blueprint, Review, Shot } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { secs } from "@/lib/client/format";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";
import { scoreTone, shotScore } from "./align";

const seen = (v?: string) => (v && !/^not visible/i.test(v.trim()) ? v : undefined);

const TONE_TEXT = { pass: "text-pass", warn: "text-warn", fail: "text-fail" } as const;

/** A frame from the analysed video when this machine has it; otherwise a dark card that describes the shot. */
export function ShotFrame({
  url,
  fallback,
  purpose,
  className,
  reference,
  textTop,
}: {
  url?: string;
  fallback: string;
  purpose: Blueprint["shots"][number]["purpose"];
  className?: string;
  reference?: boolean;
  /** in the big viewers the caption sits at the bottom, so the description goes under the label instead */
  textTop?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-viewer", className)}>
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
            <span className="absolute top-1 left-1 rounded-[2px] bg-white/85 px-1 font-semibold text-[#111] text-[8.5px] uppercase tracking-[0.04em]">
              brand art
            </span>
          )}
        </>
      ) : (
        <div
          className={cn("absolute inset-0 flex flex-col gap-1 p-2", textTop ? "justify-start pt-12" : "justify-end")}
        >
          <span className="h-[2px] w-6" style={{ background: PURPOSE_COLOR[purpose] }} />
          <p
            className={cn(
              "text-white/70 leading-snug",
              textTop ? "line-clamp-6 text-[13px]" : "line-clamp-3 text-[10.5px]",
            )}
          >
            {fallback}
          </p>
        </div>
      )}
    </div>
  );
}

const LANE_LABEL = "w-[76px] shrink-0 pr-3 text-right text-[11px] font-semibold text-bone-2";

/**
 * NLE-style lanes on one time axis: V1 the original's shots, V2 our remake aligned through shotMap,
 * T1 the words, and the beat tape. One red playhead crosses every lane; click or drag anywhere to scrub.
 */
export function Timeline({
  bp,
  aligned,
  keyframes,
  references,
  review,
  t,
  onScrub,
}: {
  bp: Blueprint;
  aligned: (Shot | undefined)[];
  keyframes: Map<number, string>;
  references: string[];
  review?: Review;
  t: number;
  onScrub: (t: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const D = bp.durationSec;
  const active = bp.shots.findIndex((s) => t >= s.t0 && t < s.t1);
  const activeIdx = active === -1 ? bp.shots.length - 1 : active;
  const pct = (x: number) => `${(x / D) * 100}%`;
  const ticks = Array.from({ length: Math.floor(D) + 1 }, (_, i) => i);
  const noRemake = aligned.every((x) => !x);
  const tickEvery = D > 30 ? 5 : 2;

  const fromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    onScrub(Math.max(0, Math.min(D - 0.001, ((clientX - r.left) / r.width) * D)));
  };
  const step = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(bp.shots.length - 1, activeIdx + dir));
    onScrub(bp.shots[next].t0 + 0.001);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[760px]">
        <div className="flex flex-col pt-7" aria-hidden>
          <div className={cn(LANE_LABEL, "flex h-[84px] items-center justify-end")}>V1 Original</div>
          <div className={cn(LANE_LABEL, "mt-1 flex h-[84px] items-center justify-end")}>V2 Remake</div>
          <div className={cn(LANE_LABEL, "mt-1 flex h-9 items-center justify-end")}>T1 Words</div>
          <div className={cn(LANE_LABEL, "mt-1 flex h-6 items-center justify-end")}>Beats</div>
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
          className="relative min-w-0 flex-1 cursor-ew-resize touch-none select-none"
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
          <div className="relative h-7 border-line border-b">
            {ticks.map((s) => (
              <span key={s} className="absolute bottom-0" style={{ left: pct(s) }}>
                <span className={cn("absolute bottom-0 w-px bg-bone-4", s % tickEvery === 0 ? "h-2.5" : "h-1.5")} />
                {s % tickEvery === 0 && (
                  <span className="absolute bottom-3 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-bone-3">
                    {tc(s)}
                  </span>
                )}
              </span>
            ))}
          </div>

          <div className="relative h-[84px]">
            {bp.shots.map((s, i) => {
              const inShot = bp.frames.filter((f) => f.t >= s.t0 && f.t < s.t1);
              const on = i === activeIdx;
              return (
                <div
                  key={s.idx}
                  data-testid={`bp-shot-${i}`}
                  data-active={on || undefined}
                  className="absolute inset-y-0 px-px"
                  style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
                >
                  <div
                    className={cn(
                      "flex h-full overflow-hidden rounded-[3px] bg-viewer",
                      on && "outline-2 outline-bone outline-offset-1 outline",
                    )}
                  >
                    {inShot.length ? (
                      inShot.map((f) => (
                        <ShotFrame
                          key={f.t}
                          url={f.url}
                          fallback=""
                          purpose={s.purpose}
                          className="h-full min-w-[34px] flex-1"
                        />
                      ))
                    ) : (
                      <ShotFrame
                        fallback={[seen(s.subject), seen(s.action)].filter(Boolean).join(": ")}
                        purpose={s.purpose}
                        className="h-full w-full"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-1 h-[84px]">
            {noRemake && (
              <div
                className="absolute inset-0 grid place-items-center rounded-[3px] border border-line-strong border-dashed bg-raised-2"
                data-testid="remake-pending"
              >
                <p className="text-[13px] text-bone-2">
                  The remake lands here, shot for shot, once production runs on this research.
                </p>
              </div>
            )}
            {!noRemake &&
              bp.shots.map((s, i) => {
                const ours = aligned[i];
                const on = i === activeIdx;
                const kf = ours ? keyframes.get(ours.idx) : undefined;
                const ref = !kf && references.length ? references[i % references.length] : undefined;
                const sc = shotScore(review, ours?.idx);
                return (
                  <div
                    key={s.idx}
                    data-testid={`remake-shot-${i}`}
                    className="absolute inset-y-0 px-px"
                    style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
                  >
                    {ours ? (
                      <div
                        className={cn(
                          "relative h-full overflow-hidden rounded-[3px]",
                          on && "outline-2 outline-bone outline-offset-1 outline",
                        )}
                      >
                        <ShotFrame
                          url={kf ?? ref}
                          reference={!kf && !!ref}
                          fallback={ours.visualPrompt}
                          purpose={s.purpose}
                          className="h-full w-full"
                        />
                        {sc && (
                          <span
                            title={sc.issues.join("; ") || "No issues found"}
                            className={cn(
                              "absolute top-1 right-1 rounded-[2px] bg-white px-1 font-mono text-[10.5px] tabular-nums",
                              TONE_TEXT[scoreTone(sc.score)],
                            )}
                            data-testid={`remake-score-${i}`}
                          >
                            {sc.score}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center rounded-[3px] border border-line border-dashed text-[10px] text-bone-3">
                        no shot
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="relative mt-1 h-9">
            {bp.shots.map((s, i) => (
              <div
                key={s.idx}
                className="absolute inset-y-0 px-px"
                style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
              >
                <div
                  className={cn(
                    "h-full overflow-hidden rounded-[3px] border-line border-l px-1.5 py-1",
                    i === activeIdx && "bg-raised-2",
                  )}
                >
                  <p className="line-clamp-2 text-[10.5px] text-bone-2 leading-tight">
                    {seen(s.voiceover) ?? seen(s.onScreenText) ?? ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-1 h-6">
            {bp.shots.map((s) => (
              <div
                key={s.idx}
                className="absolute inset-y-0 px-px"
                style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }}
              >
                <div
                  className="flex h-full items-center rounded-[2px] px-1.5"
                  style={{ background: PURPOSE_COLOR[s.purpose] }}
                >
                  <span className="truncate font-semibold text-[10px] text-white uppercase tracking-[0.04em]">
                    {PURPOSE_LABEL[s.purpose]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <span
            className="pointer-events-none absolute top-7 bottom-0 w-px border-bone-3 border-l border-dashed"
            style={{ left: pct(bp.hook.endSec) }}
            aria-hidden
          />
          <div className="pointer-events-none absolute top-0 bottom-0 z-10" style={{ left: pct(t) }} aria-hidden>
            <span className="absolute top-0 -left-[6px] h-0 w-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-signal" />
            <span className="absolute top-0 bottom-0 -left-px w-[2px] bg-signal" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[76px] text-[11px] text-bone-3">
        <span>Dashed line: the hook ends at {secs(bp.hook.endSec)}.</span>
        <span>Click, drag, or use the arrow keys to move between shots.</span>
      </div>
    </div>
  );
}

/** 2.5 -> "00:02.5" (timecode: minutes, seconds and tenths). */
export function tc(s: number) {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
}
