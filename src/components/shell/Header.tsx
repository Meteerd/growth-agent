"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBadge, StatusDot } from "@/components/ui/Badge";
import { cn } from "@/lib/client/cn";
import { DATA_MODE, READ_ONLY } from "@/lib/client/mode";
import { PRODUCT_NAME } from "@/lib/client/product";

const NAV = [
  { href: "/brands", label: "Portfolio" },
  { href: "/settings", label: "Providers" },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label={`${PRODUCT_NAME} home`}>
      <span aria-hidden className="grid size-[22px] place-items-center rounded-[4px] bg-bone">
        <span className="size-[7px] rounded-[1px] bg-signal" />
      </span>
      <span className="font-semibold text-[18px] leading-none tracking-[-0.02em]">{PRODUCT_NAME}</span>
    </Link>
  );
}

export function DataModeChip() {
  if (READ_ONLY)
    return (
      <span
        title="Recorded runs only. Live runs happen in the operator app."
        className="inline-flex h-6 items-center rounded-chip px-2.5 font-medium text-[11.5px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
      >
        Read-only showcase
      </span>
    );
  return DATA_MODE === "mock" ? (
    <span data-dev>
      <DemoBadge label="Mock data" />
    </span>
  ) : (
    <span
      data-dev
      className="inline-flex h-6 items-center gap-1.5 rounded-chip px-2.5 font-medium text-[11.5px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
    >
      <StatusDot status="live" />
      Engine
    </span>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40">
      <div className="pointer-events-none absolute inset-0 border-line border-b bg-ink" />
      <div className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:gap-6 md:px-8">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center gap-1 md:ml-2">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-chip px-3 py-1.5 text-ui transition-colors duration-150",
                  active
                    ? "bg-glass text-bone shadow-[inset_0_0_0_1px_var(--color-line)]"
                    : "text-bone-2 hover:text-bone",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden h-7 items-center gap-2 rounded-chip px-2.5 text-[12px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:text-bone md:flex"
            data-testid="palette-open"
          >
            Jump to <kbd className="font-mono text-[11px] text-bone-3">⌘K</kbd>
          </button>
          <DataModeChip />
        </div>
      </div>
    </header>
  );
}
