"use client";

import { ReactLenis } from "lenis/react";
import { useEffect, useState } from "react";

// Lenis on the root scroller; skipped entirely for reduced motion.
export function SmoothScroll() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  if (!enabled) return null;
  return <ReactLenis root options={{ lerp: 0.12, wheelMultiplier: 0.9, autoRaf: true }} />;
}
