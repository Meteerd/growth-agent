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
      <span aria-hidden className="relative grid size-6 place-items-center">
        <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_var(--color-bone-3)] transition-transform duration-500 ease-out group-hover:scale-110" />
        <span className="absolute inset-[5px] rounded-full shadow-[inset_0_0_0_1px_var(--color-bone-4)]" />
        <span className="size-1.5 rounded-full bg-signal" />
      </span>
      <span className="font-serif text-[22px] leading-none tracking-[-0.01em]">{PRODUCT_NAME}</span>
    </Link>
  );
}

export function DataModeChip() {
  return DATA_MODE === "mock" ? (
    <DemoBadge label="Mock data" />
  ) : (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-chip px-2.5 font-mono text-[10.5px] text-bone-2 uppercase tracking-[0.06em] shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
      <StatusDot status="live" />
      Engine
    </span>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(6_7_10/0.92),rgb(6_7_10/0.6)_70%,transparent)] backdrop-blur-[6px] [mask-image:linear-gradient(180deg,#000_60%,transparent)]" />
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
          <DataModeChip />
        </div>
      </div>
    </header>
  );
}
