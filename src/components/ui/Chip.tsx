"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/client/cn";
import { useMagnetic } from "@/lib/client/useMagnetic";

export type ChipOption = { id: string; label: string; hint?: string };

const chipClass = cn(
  "group relative inline-flex min-h-11 items-center gap-2 rounded-chip px-5 py-2.5 text-left text-body",
  "bg-glass text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
  "transition-[background-color,box-shadow,color,transform] duration-150 ease-out",
  "hover:bg-glass-strong hover:shadow-[inset_0_0_0_1px_rgb(17_17_17/0.28)]",
  "data-[state=on]:bg-bone data-[state=on]:text-ink data-[state=on]:shadow-none",
  "disabled:opacity-40",
);

function Chip({ option, index }: { option: ChipOption; index: number }) {
  const ref = useMagnetic<HTMLButtonElement>(0.18, 5);
  return (
    <ToggleGroup.Item ref={ref} value={option.id} className={chipClass} aria-label={option.label}>
      <span className="font-mono text-[10px] text-bone-3 group-data-[state=on]:text-ink/70">
        {String.fromCharCode(65 + index)}
      </span>
      <span className="flex flex-col">
        <span>{option.label}</span>
        {option.hint && (
          <span className="text-[12px] text-bone-3 group-data-[state=on]:text-ink/70">{option.hint}</span>
        )}
      </span>
    </ToggleGroup.Item>
  );
}

/** Answer chips: single or multi choice, magnetic, keyboard-roving (Radix ToggleGroup, fully restyled). */
export function ChipGroup(
  props: { options: ChipOption[]; className?: string; disabled?: boolean } & (
    | { type: "single"; value: string; onChange: (v: string) => void }
    | { type: "multi"; value: string[]; onChange: (v: string[]) => void }
  ),
) {
  const items = props.options.map((o, i) => <Chip key={o.id} option={o} index={i} />);
  const cls = cn("flex flex-wrap gap-2", props.className);
  return props.type === "single" ? (
    <ToggleGroup.Root
      type="single"
      value={props.value}
      onValueChange={(v) => v && props.onChange(v)}
      className={cls}
      disabled={props.disabled}
      aria-label="Answer"
    >
      {items}
    </ToggleGroup.Root>
  ) : (
    <ToggleGroup.Root
      type="multiple"
      value={props.value}
      onValueChange={props.onChange}
      className={cls}
      disabled={props.disabled}
      aria-label="Answers"
    >
      {items}
    </ToggleGroup.Root>
  );
}
