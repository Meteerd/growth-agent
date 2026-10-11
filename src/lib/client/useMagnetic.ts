"use client";

import { useEffect, useRef } from "react";

/** Subtle magnetic pull toward the cursor (primary buttons and answer chips only). Off for touch and reduced motion. */
export function useMagnetic<T extends HTMLElement>(strength = 0.22, max = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const clamp = (v: number) => Math.max(-max, Math.min(max, v * strength));
      el.style.transform = `translate3d(${clamp(dx)}px, ${clamp(dy)}px, 0)`;
    };
    const leave = () => {
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength, max]);
  return ref;
}
