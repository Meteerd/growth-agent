"use client";

import { motion } from "motion/react";
import { Tabs as T } from "radix-ui";
import { useId } from "react";
import { cn } from "@/lib/client/cn";

/** Segmented tabs with a sliding indicator. Content is rendered by the caller via TabPanel. */
export function Tabs({
  value,
  onValueChange,
  items,
  children,
  className,
  size = "md",
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: React.ReactNode }[];
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <T.Root value={value} onValueChange={onValueChange} className={className}>
      <T.List className="inline-flex rounded-chip bg-glass p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
        {items.map((it) => (
          <T.Trigger
            key={it.value}
            value={it.value}
            className={cn(
              "relative rounded-chip font-medium text-bone-2 transition-colors duration-150 hover:text-bone data-[state=active]:text-ink",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-4 text-ui",
            )}
          >
            {value === it.value && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-chip bg-bone"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className="relative">{it.label}</span>
          </T.Trigger>
        ))}
      </T.List>
      {children}
    </T.Root>
  );
}

export const TabPanel = T.Content;
