"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBadge, StatusDot } from "@/components/ui/Badge";
import { cn } from "@/lib/client/cn";
import { DATA_MODE } from "@/lib/client/mode";
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
  return DATA_MODE === "mock" ? (
    <DemoBadge label="Mock data" />
  ) : (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-chip px-2.5 font-mono text-[10.5px] text-bone-2 uppercase tracking-[0.06em] shadow[inset_0_0_0_1px_var(--color-line-strong)]">
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
      <div className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 md:px-8">
        <Wordmark />
        <nav aria-label="Main" className="ml-2 flex items-center gap-1">
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
                    ? "bg-glass text-bone shadow[inset_0_0_0_1px_var(--color-line)]"
                    : "text-bone-2 hover:text-bone",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <DataModeChip />
        </div>
      </div>
    </header>
  );
}
