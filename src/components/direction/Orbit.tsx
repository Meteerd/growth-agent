"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { type Brand, CHANNEL_LABELS, type Channel, type ChannelMode, type ChannelPlan } from "@/contracts";
import { cn } from "@/lib/client/cn";
import {
  bodySize,
  CENTER,
  easeOutCubic,
  firstSentence,
  orbitRadius,
  polar,
  R_CORE,
  R_NOT_NOW,
  R_OUTER,
  ringTicks,
  seedAngle,
  spreadAngles,
  TAU,
  VIEW,
} from "./geometry";
import { MODE_HUE, MODE_TEXT, ModeBadge, NOT_NOW_HUE, notNowReason, pad2, Radar, ScoreBar } from "./parts";

type Body = {
  id: string;
  channel: Channel;
  kind: "rec" | "notNow";
  r: number;
  theta: number;
  d: number;
  delay: number;
  score?: number;
  priority?: number;
  mode?: ChannelMode;
};

const SWEEP = 0.9; // radians a body travels along its orbit on entrance
const ENTER_MS = 900;
const OMEGA = TAU / 240_000; // idle rotation: one turn per 4 minutes
const EASE = [0.22, 1, 0.36, 1] as const;
const DIAL = Array.from({ length: 72 }, (_, i) => i);

function useLayout(plan: ChannelPlan) {
  return useMemo(() => {
    const recs = [...plan.channels].sort((a, b) => a.priority - b.priority);
    const ticks = ringTicks(Math.min(100, ...recs.map((c) => c.score)));
    const outer = ticks.at(-1)!;
    // 12 o'clock (the score ruler) starts mid-gap, priority 1 roughly opposite it, nudged by a stable per-brand seed
    const gap = Math.PI / Math.max(recs.length, 1);
    const jitter = ((seedAngle(plan.brandId) - Math.PI) / TAU) * gap * 0.5;
    const offset = -Math.PI / 2 + gap + Math.floor(recs.length / 2) * 2 * gap + jitter;
    const recAngles = spreadAngles(recs.length, offset);
    const m = plan.notNow.length;
    const nnAngles = spreadAngles(m, offset + gap);
    const scoreOf = new Map((plan.considered ?? []).map((c) => [c.channel, c.score]));
    const bodies: Body[] = [
      ...recs.map((c, i) => ({
        id: `rec-${c.channel}`,
        channel: c.channel,
        kind: "rec" as const,
        r: orbitRadius(c.score, outer),
        theta: recAngles[i],
        d: bodySize(c.priority, recs.length),
        delay: 380 + i * 80,
        score: c.score,
        priority: c.priority,
        mode: c.mode,
      })),
      ...plan.notNow.map((n, j) => ({
        id: `nn-${n.channel}`,
        channel: n.channel,
        kind: "notNow" as const,
        r: R_NOT_NOW,
        theta: nnAngles[j],
        d: 46,
        delay: 1100 + j * 70,
        score: scoreOf.get(n.channel),
      })),
    ];
    const nnLabelTheta = (nnAngles[0] ?? 0) + Math.PI / Math.max(m, 1);
    return { bodies, ticks, outer, nnLabelTheta };
  }, [plan]);
}

/** Orbit map + inspect card. Bodies are real buttons positioned by one rAF loop (entrance sweep + idle rotation). */
export function OrbitView({
  plan,
  brand,
  evidenceCount,
  onOpen,
}: {
  plan: ChannelPlan;
  brand?: Brand;
  evidenceCount: (c: Channel) => number;
  onOpen: (c: Channel) => void;
}) {
  const reduce = !!useReducedMotion();
  const { bodies, ticks, outer, nnLabelTheta } = useLayout(plan);
  const [active, setActive] = useState<Channel | null>(null);
  const [last, setLast] = useState<Channel | null>(null);
  const [k, setK] = useState(1);
  const inspect = active ?? last ?? plan.channels.find((c) => c.priority === 1)?.channel ?? null;

  const wrap = useRef<HTMLElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const dial = useRef<SVGGElement>(null);
  const ruler = useRef<SVGGElement>(null);
  const nnLabel = useRef<SVGTextElement>(null);
  const spoke = useRef<SVGLineElement>(null);
  const paused = useRef({ hover: false, focus: false });
  const activeId = useRef<string | null>(null);
  const writeNow = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let scale = el.clientWidth / VIEW;
    setK(scale);
    const t0 = performance.now();
    let rot = 0;
    let prev = t0;
    let raf = 0;
    const write = (t: number) => {
      const dt = Math.min(64, t - prev); // a hidden tab does not jump the map forward
      prev = t;
      if (!reduce && !paused.current.hover && !paused.current.focus) rot += dt * OMEGA;
      let nearTop = false;
      for (const b of bodies) {
        const node = els.current.get(b.id);
        if (!node) continue;
        const p = reduce ? 1 : easeOutCubic((t - t0 - b.delay) / ENTER_MS);
        const th = b.theta + rot - (b.kind === "rec" ? SWEEP * (1 - p) : 0);
        const x = CENTER + b.r * Math.cos(th);
        const y = CENTER + b.r * Math.sin(th);
        node.style.transform = `translate3d(${(x * scale).toFixed(2)}px, ${(y * scale).toFixed(2)}px, 0) translate(-50%, -50%)`;
        node.style.opacity = String(Math.min(1, p * 2.2));
        const fromTop = Math.abs(Math.atan2(Math.sin(th + Math.PI / 2), Math.cos(th + Math.PI / 2)));
        if (b.kind === "rec" && fromTop < Math.asin(Math.min(1, (b.d / 2 + 22) / b.r))) nearTop = true;
        if (activeId.current === b.id && spoke.current) {
          const a = polar(R_CORE - 12, th);
          spoke.current.setAttribute("x1", a.x.toFixed(2));
          spoke.current.setAttribute("y1", a.y.toFixed(2));
          spoke.current.setAttribute("x2", x.toFixed(2));
          spoke.current.setAttribute("y2", y.toFixed(2));
        }
      }
      dial.current?.setAttribute("transform", `rotate(${((rot * 180) / Math.PI).toFixed(3)} ${CENTER} ${CENTER})`);
      // the score ruler steps aside while a body passes 12 o'clock
      if (ruler.current) ruler.current.style.opacity = nearTop ? "0" : "1";
      if (nnLabel.current) {
        const pt = polar(R_NOT_NOW, nnLabelTheta + rot);
        nnLabel.current.setAttribute("x", pt.x.toFixed(2));
        nnLabel.current.setAttribute("y", (pt.y + 3.5).toFixed(2));
      }
    };
    writeNow.current = () => write(performance.now());
    const loop = (t: number) => {
      write(t);
      raf = requestAnimationFrame(loop);
    };
    write(t0);
    if (!reduce) raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => {
      scale = el.clientWidth / VIEW;
      setK(scale);
      write(performance.now());
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bodies, nnLabelTheta, reduce]);

  useEffect(() => {
    activeId.current = active ? (bodies.find((b) => b.channel === active)?.id ?? null) : null;
    writeNow.current(); // reduced motion has no loop, so place the spoke here too
  }, [active, bodies]);

  const enter = (c: Channel) => {
    setActive(c);
    setLast(c);
  };
  const activeBody = bodies.find((b) => b.channel === active);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative overflow-hidden rounded-panel bg-[radial-gradient(70%_60%_at_50%_45%,rgb(107_78_113/0.07),transparent_70%)] p-3 hairline sm:p-5">
        <FrameNotes count={plan.channels.length} notNow={plan.notNow.length} />
        <section
          ref={wrap}
          aria-label="Orbit map. Closer to the brand means a higher score, a larger body means a higher priority. Rejected channels sit outside the outer ring."
          data-testid="orbit-map"
          className="relative mx-auto aspect-square w-full max-w-[640px]"
          style={{ "--k": k } as React.CSSProperties}
          onPointerEnter={() => {
            paused.current.hover = true;
          }}
          onPointerLeave={() => {
            paused.current.hover = false;
            setActive(null);
          }}
          onFocus={() => {
            paused.current.focus = true;
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) paused.current.focus = false;
          }}
        >
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id="orbit-core-glow">
                <stop offset="0%" stopColor="#ECE7DD" stopOpacity="0.16" />
                <stop offset="45%" stopColor="#5B3CFF" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#06070A" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={CENTER} cy={CENTER} r={R_OUTER * 0.72} fill="url(#orbit-core-glow)" />
            {/* rotating measurement dial: 5 degree ticks, longer every 30 */}
            <g ref={dial}>
              {DIAL.map((i) => {
                const major = i % 6 === 0;
                const a = polar(R_NOT_NOW + 24, (i * TAU) / 72);
                const b = polar(R_NOT_NOW + (major ? 32 : 28), (i * TAU) / 72);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={major ? "rgb(17 17 17 / 0.28)" : "rgb(17 17 17 / 0.12)"}
                    strokeWidth="1"
                  />
                );
              })}
            </g>
            {/* score rings, inner first */}
            {[...ticks].reverse().map((t, i) => (
              <motion.circle
                key={t}
                cx={CENTER}
                cy={CENTER}
                r={orbitRadius(t, outer)}
                fill="none"
                stroke={t === outer ? "rgb(17 17 17 / 0.24)" : "rgb(17 17 17 / 0.15)"}
                strokeWidth="1"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.08 + i * 0.07, ease: EASE }}
              />
            ))}
            {plan.notNow.length > 0 && (
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={R_NOT_NOW}
                fill="none"
                stroke="rgb(17 17 17 / 0.16)"
                strokeWidth="1"
                strokeDasharray="1.5 7"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              />
            )}
            {activeBody?.kind === "rec" && (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={activeBody.r}
                fill="none"
                stroke={MODE_HUE[activeBody.mode ?? "both"]}
                strokeOpacity="0.4"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
            )}
            <line
              ref={spoke}
              x1={CENTER}
              y1={CENTER}
              x2={CENTER}
              y2={CENTER}
              stroke="rgb(17 17 17 / 0.45)"
              strokeWidth="1"
              strokeDasharray="3 4"
              className={cn("transition-opacity duration-150", active ? "opacity-100" : "opacity-0")}
            />
            <g ref={ruler} className="transition-opacity duration-500">
              <line
                x1={CENTER}
                y1={CENTER - R_CORE - 6}
                x2={CENTER}
                y2={CENTER - R_OUTER - 10}
                stroke="rgb(17 17 17 / 0.18)"
                strokeWidth="1"
                strokeDasharray="1 3"
              />
              {ticks.map((t) => {
                const y = CENTER - orbitRadius(t, outer);
                return (
                  <g key={t}>
                    <line x1={CENTER - 4} y1={y} x2={CENTER + 4} y2={y} stroke="rgb(17 17 17 / 0.45)" strokeWidth="1" />
                    <text
                      x={CENTER + 9}
                      y={y - 5}
                      className="font-mono"
                      style={{ fontSize: "max(11px, calc(9px / var(--k)))" }}
                      fill="rgb(17 17 17 / 0.55)"
                      stroke="#06070A"
                      strokeWidth="4"
                      paintOrder="stroke"
                    >
                      {t}
                    </text>
                  </g>
                );
              })}
            </g>
            {plan.notNow.length > 0 && (
              <text
                ref={nnLabel}
                x={CENTER}
                y={CENTER}
                textAnchor="middle"
                className="font-mono"
                style={{ fontSize: "max(10px, calc(8.5px / var(--k)))" }}
                letterSpacing="0.12em"
                fill="rgb(17 17 17 / 0.42)"
                stroke="#06070A"
                strokeWidth="5"
                paintOrder="stroke"
              >
                NOT NOW
              </text>
            )}
          </svg>

          <motion.div
            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 grid place-items-center"
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span
              aria-hidden
              className="absolute size-[calc(var(--k)*104px)] rounded-full shadow-[inset_0_0_0_1px_rgb(17_17_17/0.14)]"
            />
            <span style={{ transform: `scale(${Math.max(k, 0.42)})` }}>
              {brand ? (
                <BrandMark brand={brand} size={64} className="rounded-full" />
              ) : (
                <span className="block size-16 rounded-full bg-bone/5" />
              )}
            </span>
          </motion.div>

          {bodies.map((b) => (
            <div
              key={b.id}
              ref={(n) => {
                if (n) els.current.set(b.id, n);
                else els.current.delete(b.id);
              }}
              className="absolute top-0 left-0 opacity-0"
              style={{ width: `max(${b.kind === "rec" ? 30 : 24}px, calc(var(--k) * ${b.d}px))` }}
            >
              <BodyButton
                b={b}
                dim={active !== null && active !== b.channel}
                lit={active === b.channel}
                onEnter={() => enter(b.channel)}
                onLeave={() => setActive(null)}
                onOpen={() => onOpen(b.channel)}
              />
            </div>
          ))}
        </section>
      </div>
      {inspect && (
        <InspectCard
          plan={plan}
          channel={inspect}
          live={active !== null}
          evidence={evidenceCount(inspect)}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

const SPHERE =
  "radial-gradient(circle at 32% 26%, rgb(255 255 255 / 0.17), rgb(255 255 255 / 0.045) 44%, rgb(8 9 13 / 0.6) 100%)";

function BodyButton({
  b,
  dim,
  lit,
  onEnter,
  onLeave,
  onOpen,
}: {
  b: Body;
  dim: boolean;
  lit: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const label = CHANNEL_LABELS[b.channel];
  const rec = b.kind === "rec";
  const hue = rec ? MODE_HUE[b.mode ?? "both"] : NOT_NOW_HUE;
  const name = rec
    ? `${label}, score ${b.score}, priority ${b.priority}, ${MODE_TEXT[b.mode ?? "both"].toLowerCase()}`
    : `${label}, not now${b.score != null ? `, score ${b.score}` : ""}`;
  const opacity = rec ? (dim ? 0.5 : 1) : lit ? 1 : dim ? 0.2 : 0.4;
  return (
    <button
      type="button"
      aria-label={name}
      data-testid={rec ? `orbit-body-${b.channel}` : `notnow-body-${b.channel}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onOpen}
      className={cn(
        "relative grid aspect-square w-full place-items-center rounded-full outline-offset-4",
        "transition-[opacity,transform] duration-300 ease-out",
        lit && "scale-[1.07]",
      )}
      style={{ opacity }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full transition-shadow duration-300"
        style={{
          background: rec ? `${SPHERE}, radial-gradient(circle at 70% 82%, ${hue}26, transparent 62%)` : SPHERE,
          boxShadow: lit
            ? `inset 0 0 0 1px rgb(17 17 17 / 0.4), 0 0 0 6px rgb(17 17 17 / 0.04), 0 14px 50px -10px ${hue}88`
            : `inset 0 0 0 1px rgb(17 17 17 / 0.14), 0 12px 40px -14px ${rec ? `${hue}66` : "transparent"}`,
        }}
      />
      <svg aria-hidden viewBox="0 0 100 100" className="-rotate-90 absolute inset-0 size-full overflow-visible">
        {rec ? (
          <circle
            cx="50"
            cy="50"
            r="49"
            fill="none"
            stroke={hue}
            strokeWidth="1.6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${b.score ?? 0} 100`}
            style={{ filter: `drop-shadow(0 0 3px ${hue})` }}
          />
        ) : (
          <circle cx="50" cy="50" r="49" fill="none" stroke={hue} strokeWidth="1.5" strokeDasharray="3 6" />
        )}
      </svg>
      <span
        className={cn("relative font-mono tabular-nums leading-none", rec ? "text-bone" : "text-bone-2")}
        style={{ fontSize: `max(${rec ? 12 : 10}px, calc(var(--k) * ${Math.round(b.d * (rec ? 0.27 : 0.3))}px))` }}
      >
        {b.score ?? <SlashGlyph />}
      </span>
      <span
        aria-hidden
        className="-translate-x-1/2 pointer-events-none absolute top-full left-1/2 mt-[max(4px,calc(var(--k)*9px))] flex items-baseline gap-1.5 whitespace-nowrap"
      >
        {rec && (
          <span className="font-mono text-[max(9px,calc(var(--k)*10.5px))] text-bone-3 tabular-nums">
            {pad2(b.priority ?? 0)}
          </span>
        )}
        <span
          className={cn(
            "font-medium tracking-[-0.01em]",
            rec
              ? "text-[max(11px,calc(var(--k)*13.5px))] text-bone"
              : "text-[max(10px,calc(var(--k)*11.5px))] text-bone-2",
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

function SlashGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-[0.9em]" fill="none" aria-hidden>
      <path d="M2.5 9.5 9.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FrameNotes({ count, notNow }: { count: number; notNow: number }) {
  return (
    <>
      <p className="mono-label pointer-events-none absolute top-4 left-4 hidden text-bone-3 sm:block">
        orbit / distance = score
      </p>
      <p className="pointer-events-none absolute top-4 right-4 hidden font-mono text-[11px] text-bone-3 tabular-nums sm:block">
        {pad2(count)} picks / {pad2(notNow)} not now
      </p>
      <ul className="pointer-events-none absolute bottom-4 left-4 hidden flex-col gap-1.5 font-mono text-[10.5px] text-bone-3 sm:flex">
        {(["organic", "paid", "both"] as const).map((m) => (
          <li key={m} className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full"
              style={{ background: MODE_HUE[m], boxShadow: `0 0 6px ${MODE_HUE[m]}` }}
            />
            {MODE_TEXT[m].toLowerCase()}
          </li>
        ))}
      </ul>
      <p className="pointer-events-none absolute right-4 bottom-4 hidden max-w-[16ch] text-right font-mono text-[10.5px] text-bone-3 leading-snug sm:block">
        size = priority, rim = score
      </p>
    </>
  );
}

function InspectCard({
  plan,
  channel,
  live,
  evidence,
  onOpen,
}: {
  plan: ChannelPlan;
  channel: Channel;
  live: boolean;
  evidence: number;
  onOpen: (c: Channel) => void;
}) {
  const rec = plan.channels.find((c) => c.channel === channel);
  const nn = rec ? undefined : plan.notNow.find((n) => n.channel === channel);
  const considered = plan.considered?.find((c) => c.channel === channel);
  const scores = rec?.scores ?? considered?.scores;
  const hue = rec ? MODE_HUE[rec.mode] : NOT_NOW_HUE;
  const label = CHANNEL_LABELS[channel];
  return (
    <aside
      data-testid="inspect-card"
      data-channel={channel}
      aria-label={`${label} details`}
      className="glass flex flex-col gap-5 self-start p-5 lg:sticky lg:top-48"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label">
            {rec ? `Priority ${pad2(rec.priority)}` : "Not now"}
            {!live && rec?.priority === 1 && <span className="text-bone-3"> / top pick</span>}
          </p>
          <h3 className="mt-2 truncate font-display text-[34px] leading-none">{label}</h3>
        </div>
        {rec && <ModeBadge mode={rec.mode} className="mt-0.5" />}
      </header>
      {rec && <ScoreBar score={rec.score} hue={hue} />}
      {!rec && considered && (
        <p className="font-mono text-[12px] text-bone-2 tabular-nums">
          scored <span className="text-bone">{considered.score}</span> / 100 before it was ruled out
        </p>
      )}
      {scores ? (
        <Radar
          scores={scores}
          hue={rec ? hue : "#ECE7DD"}
          drawKey={channel}
          className="mx-auto w-full max-w-[280px]"
          title={`${label} scores on six axes`}
        />
      ) : (
        <p className="text-bone-3 text-ui">No axis scores were recorded for this channel.</p>
      )}
      <p className="text-bone-2 text-ui leading-relaxed" data-testid="inspect-text">
        {rec ? firstSentence(rec.rationale) : nn ? notNowReason(channel, nn.reason) : ""}
      </p>
      <div className="flex items-center justify-between gap-3 border-line border-t pt-4">
        <span className="font-mono text-[10.5px] text-bone-3">
          {live ? "Enter opens the evidence" : "Hover or focus a body"}
        </span>
        <Button size="sm" onClick={() => onOpen(channel)} disabled={!rec && !nn}>
          Evidence
          <span className="font-mono text-[11px] text-bone-3 tabular-nums">{evidence}</span>
        </Button>
      </div>
    </aside>
  );
}
