"use client";

import { type FieldAccent, useField } from "@/lib/client/field";

const PRESETS: [string, number][] = [
  ["idle", 0.15],
  ["waiting", 0.35],
  ["running", 0.6],
  ["peak", 1],
];

export function FieldControls() {
  const { activity, vortex, accent, set } = useField();
  return (
    <div className="glass grid gap-6 p-6 md:grid-cols-[1fr_1fr_auto]">
      <Slider label="activity" value={activity} onChange={(v) => set({ activity: v })} />
      <Slider label="vortex" value={vortex} onChange={(v) => set({ vortex: v })} />
      <div className="flex flex-col gap-3">
        <span className="mono-label">accent</span>
        <div className="flex gap-1.5">
          {(["signal", "cyan", "violet"] as FieldAccent[]).map((a) => (
            <button
              key={a}
              onClick={() => set({ accent: a })}
              aria-pressed={accent === a}
              className="rounded-chip px-3 py-1.5 font-mono text-[11px] text-bone-2 hairline transition-colors duration-150 aria-pressed:bg-bone aria-pressed:text-ink"
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 md:col-span-3">
        {PRESETS.map(([n, v]) => (
          <button
            key={n}
            onClick={() => set({ activity: v, vortex: 0 })}
            className="rounded-chip px-3 py-1.5 font-mono text-[11px] text-bone-2 hairline transition-colors duration-150 hover:text-bone"
          >
            {n} {v.toFixed(2)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-3">
      <span className="flex items-baseline justify-between">
        <span className="mono-label">{label}</span>
        <span className="font-mono text-ui">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ "--v": `${value * 100}%` } as React.CSSProperties}
        aria-label={label}
      />
    </label>
  );
}
