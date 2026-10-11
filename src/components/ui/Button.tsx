"use client";

import { Slot } from "radix-ui";
import { cn } from "@/lib/client/cn";
import { useMagnetic } from "@/lib/client/useMagnetic";

type Variant = "primary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-signal text-ink shadow-[0_0_0_1px_rgb(212_255_58/0.6),0_8px_32px_-8px_rgb(212_255_58/0.55)] hover:shadow-[0_0_0_1px_rgb(212_255_58/0.9),0_10px_40px_-6px_rgb(212_255_58/0.7)] hover:brightness-105",
  ghost:
    "bg-glass text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-glass-strong hover:shadow-[inset_0_0_0_1px_rgb(236_231_221/0.24)]",
  quiet: "text-bone-2 hover:text-bone hover:bg-glass",
  danger: "text-fail shadow-[inset_0_0_0_1px_rgb(255_92_122/0.35)] hover:bg-[rgb(255_92_122/0.08)]",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-ui gap-1.5",
  md: "h-10 px-4 text-ui gap-2",
  lg: "h-12 px-6 text-body gap-2.5",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
  magnetic?: boolean;
};

export function Button({
  variant = "ghost",
  size = "md",
  loading,
  asChild,
  magnetic = variant === "primary",
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const ref = useMagnetic<HTMLButtonElement>(magnetic ? 0.22 : 0, magnetic ? 6 : 0);
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-chip font-medium tracking-[-0.01em]",
        "transition-[transform,background-color,box-shadow,color,filter,opacity] duration-150 ease-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 animate-[dot_1s_ease-in-out_infinite] rounded-full bg-current"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </span>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
