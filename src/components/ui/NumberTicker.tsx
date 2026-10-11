"use client";

import { animate } from "motion";
import { useEffect, useRef } from "react";
import { formatCount, formatUsd } from "@/lib/client/format";

type Format = "count" | "usd" | "percent" | "decimal";

export function formatValue(v: number, format: Format) {
  if (format === "usd") return formatUsd(v);
  if (format === "percent") return `${Math.round(v)}%`;
  if (format === "decimal") return v.toFixed(1);
  return formatCount(v);
}

/** Mono tabular number that ticks between values. SSR renders the final value, so screenshots never show 0. */
export function NumberTicker({
  value,
  format = "count",
  from,
  duration = 0.9,
  className,
}: {
  value: number;
  format?: Format;
  from?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number>(from ?? value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current;
    prev.current = value;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = formatValue(value, format);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatValue(format === "count" ? Math.round(v) : v, format);
      },
    });
    return () => controls.stop();
  }, [value, format, duration]);
  return (
    <span ref={ref} className={`font-mono tabular-nums ${className ?? ""}`}>
      {formatValue(from ?? value, format)}
    </span>
  );
}
