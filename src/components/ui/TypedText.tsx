"use client";

import { useEffect, useRef } from "react";

/** Types text in at ~`cps` characters per second (tool calls in the stream). SSR and reduced motion show it whole. */
export function TypedText({ text, cps = 60, className }: { text: string; cps?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(text.length, Math.ceil(((now - t0) / 1000) * cps));
      el.textContent = text.slice(0, n);
      el.dataset.typing = n < text.length ? "1" : "0";
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    el.textContent = "";
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, cps]);
  return (
    <span ref={ref} className={`typed ${className ?? ""}`}>
      {text}
    </span>
  );
}
