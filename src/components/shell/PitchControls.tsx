"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_PATH } from "@/lib/client/demoPath";
import { isPresenting } from "./PresentMode";

const TOTAL = DEMO_PATH.reduce((s, x) => s + x.secs, 0);
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Starts the 2-minute auto-play from anywhere (the Cmd+K palette dispatches it). */
export const startDemo = () => window.dispatchEvent(new Event("nexus-autoplay"));

/**
 * Presentation mode keys, in pitch order (src/lib/client/demoPath.ts): 1 to 8 jump to a screen, PageDown or ] next,
 * PageUp or [ previous (clickers send PageDown/PageUp), 0 plays the 2-minute demo on its own, Esc stops it.
 * Digits and brackets leave the consult letters and the timeline's arrow keys alone.
 */
export function PitchControls() {
  const router = useRouter();
  const path = usePathname();
  const [present, setPresent] = useState(false);
  const [auto, setAuto] = useState<{ step: number; t0: number } | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const current = DEMO_PATH.findIndex((s) => s.href === path);

  useEffect(() => {
    const sync = () => setPresent(isPresenting());
    sync();
    window.addEventListener("nexus-present", sync);
    return () => window.removeEventListener("nexus-present", sync);
  }, []);

  const go = useCallback(
    (i: number) => {
      const step = DEMO_PATH[Math.max(0, Math.min(DEMO_PATH.length - 1, i))];
      setFlash(DEMO_PATH.indexOf(step));
      router.push(step.href);
      window.scrollTo({ top: 0 });
    },
    [router],
  );
  const start = useCallback(() => {
    document.documentElement.dataset.present = "1";
    try {
      sessionStorage.setItem("nexus-present", "1");
    } catch {}
    setPresent(true);
    setAuto({ step: 0, t0: Date.now() });
    go(0);
  }, [go]);

  useEffect(() => {
    window.addEventListener("nexus-autoplay", start);
    return () => window.removeEventListener("nexus-autoplay", start);
  }, [start]);

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = Number(e.key);
      if (e.key === "0") auto ? setAuto(null) : start();
      else if (Number.isInteger(d) && d >= 1 && d <= DEMO_PATH.length) go(d - 1);
      else if (e.key === "PageDown" || e.key === "]") go(current + 1);
      else if (e.key === "PageUp" || e.key === "[") go(current < 0 ? 0 : current - 1);
      else if (e.key === "Escape" && auto) setAuto(null);
      else return;
      if (e.key !== "Escape") e.preventDefault();
      if (e.key !== "0" && e.key !== "Escape") setAuto(null); // a manual jump takes over from the auto-play
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, auto, current, go, start]);

  // auto-play: each screen for its seconds, with its scroll beats, then the next one; stops on the last screen
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!auto) return;
    const step = DEMO_PATH[auto.step];
    const t = timers.current;
    for (const [at, by] of step.scroll ?? [])
      t.push(
        window.setTimeout(
          () => window.scrollBy({ top: window.innerHeight * by, behavior: "smooth" }),
          at * step.secs * 1000,
        ),
      );
    t.push(
      window.setTimeout(() => {
        if (auto.step + 1 >= DEMO_PATH.length) return setAuto(null);
        setAuto({ step: auto.step + 1, t0: auto.t0 });
        go(auto.step + 1);
      }, step.secs * 1000),
    );
    return () => {
      for (const id of t.splice(0)) clearTimeout(id);
    };
  }, [auto, go]);

  useEffect(() => {
    if (flash == null) return;
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(id);
  }, [flash]);

  const shown = auto ? auto.step : flash;
  if (!present || shown == null) return null;
  return (
    <div
      aria-live="polite"
      data-testid="pitch-hud"
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-[6px] border border-line bg-raised px-3 py-2 text-[12px] text-bone shadow-[0_6px_24px_rgb(0_0_0/0.08)]"
    >
      {auto && <span className="size-2 rounded-full bg-signal" aria-hidden />}
      <span className="font-mono text-bone-3 tabular-nums">
        {shown + 1}/{DEMO_PATH.length}
      </span>
      <span className="font-medium">{DEMO_PATH[shown].label}</span>
      {auto && <AutoBar t0={auto.t0} />}
    </div>
  );
}

/** Elapsed share of the 2-minute demo; a CSS transition, no per-frame work. */
function AutoBar({ t0 }: { t0: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(100));
    return () => cancelAnimationFrame(id);
  }, []);
  const left = Math.max(0, TOTAL * 1000 - (Date.now() - t0));
  const from = 100 - (left / (TOTAL * 1000)) * 100;
  return (
    <span className="relative h-[3px] w-24 overflow-hidden rounded-full bg-raised-2" aria-hidden>
      <span
        className="absolute inset-y-0 left-0 bg-bone"
        style={{ width: `${w ? 100 : from}%`, transition: w ? `width ${left}ms linear` : undefined }}
      />
    </span>
  );
}
