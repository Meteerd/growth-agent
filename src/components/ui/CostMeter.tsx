"use client";

import { cn } from "@/lib/client/cn";
import { formatUsd } from "@/lib/client/format";
import { NumberTicker } from "./NumberTicker";

/** Spent and estimated shares of a cap, clamped for drawing; `over` when spent + estimate would pass the cap. */
export function costSegments(spentUsd: number, estimateUsd: number, capUsd: number) {
  const cap = Math.max(capUsd, 0.0001);
  const spentPct = Math.min(100, (spentUsd / cap) * 100);
  const estPct = Math.max(0, Math.min(100 - spentPct, (estimateUsd / cap) * 100));
  return { spentPct, estPct, over: spentUsd + estimateUsd > capUsd, near: spentUsd / cap >= 0.8 };
}

export function CostMeter({
  spentUsd,
  estimateUsd = 0,
  capUsd,
  label = "Spend",
  className,
}: {
  spentUsd: number;
  estimateUsd?: number;
  capUsd: number;
  label?: string;
  className?: string;
}) {
  const { spentPct, estPct, over, near } = costSegments(spentUsd, estimateUsd, capUsd);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label">{label}</span>
        <span className="font-mono text-ui">
          <NumberTicker value={spentUsd} format="usd" className={cn(near ? "text-warn" : "text-bone")} />
          <span className="text-bone-3"> / {formatUsd(capUsd)}</span>
        </span>
      </div>
      <div aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-bone transition-[width] duration-700 ease-out"
          style={{ width: `${spentPct}%` }}
        />
        {estPct > 0 && (
          <div
            className={cn(
              "absolute inset-y-0 bg-[repeating-linear-gradient(135deg,currentColor_0_2px,transparent_2px_5px)] transition-[width,left] duration-500",
              over ? "text-fail" : "text-bone-3",
            )}
            style={{ left: `${spentPct}%`, width: `${estPct}%` }}
          />
        )}
        {[25, 50, 75].map((t) => (
          <span key={t} className="absolute inset-y-0 w-px bg-ink/70" style={{ left: `${t}%` }} />
        ))}
      </div>
      {estimateUsd > 0 && (
        <p className={cn("font-mono text-[11px]", over ? "text-fail" : "text-bone-3")}>
          {over ? "Over the cap: " : "Next step estimate: "}+{formatUsd(estimateUsd)}
        </p>
      )}
    </div>
  );
}
