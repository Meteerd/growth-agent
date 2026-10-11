"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { Page } from "@/components/shell/PageHead";
import { RunStatusBadge, StatusDot } from "@/components/ui/Badge";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/client/cn";
import { useBrand, useRun } from "@/lib/client/queries";
import { DatasetBadge } from "./DatasetBadge";
import { RunProvider, useRunCtx } from "./RunContext";

export function RunFrame({ runId, children }: { runId: string; children: React.ReactNode }) {
  const { error } = useRun(runId);
  if (error)
    return (
      <Page>
        <EmptyState
          className="mt-16"
          title="This run does not exist"
          action={
            <Link className="font-mono text-[12px] text-signal underline underline-offset-4" href="/brands">
              Back to the portfolio
            </Link>
          }
        >
          The link may be old, or the run was started in another session.
        </EmptyState>
      </Page>
    );
  return (
    <RunProvider runId={runId}>
      <Page>
        <RunHeader />
        <div className="pt-6">{children}</div>
      </Page>
    </RunProvider>
  );
}

function RunHeader() {
  const { runId, run, liveStatus, events, connection } = useRunCtx();
  const { data: brand } = useBrand(run?.brandId);
  const path = usePathname();
  // the ledger total on the run is authoritative; the event sum covers a live run before the run refetches
  const cost = Math.max(
    events.reduce((s, e) => s + (e.costUsd ?? 0), 0),
    run?.costUsd ?? 0,
  );
  const questions = events.filter((e) => e.type === "question").length;
  const base = `/runs/${runId}`;
  const tabs = [
    { href: base, label: "Cockpit" },
    { href: `${base}/consult`, label: "Consult", dot: liveStatus === "waiting_input", count: questions || undefined },
    { href: `${base}/direction`, label: "Direction" },
    { href: `${base}/studio`, label: "Studio" },
    { href: `${base}/packs`, label: "Packs" },
  ];
  return (
    <div className="sticky top-16 z-30 -mx-4 bg-raised px-4 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          {brand ? <BrandMark brand={brand} size={36} /> : <Skeleton className="size-9 rounded-[10px]" />}
          <div className="min-w-0">
            <p className="mono-label truncate">
              {brand ? (
                <Link href={`/brands/${brand.slug}`} className="hover:text-bone">
                  {brand.name}
                </Link>
              ) : (
                "brand"
              )}{" "}
              / run
            </p>
            <p className="truncate font-mono text-[13px] text-bone">{runId}</p>
          </div>
        </div>
        <RunStatusBadge status={liveStatus} />
        <span className="flex items-center gap-2 font-mono text-[12px] text-bone-2">
          <span className="text-bone-3">spend</span>
          <NumberTicker value={cost} format="usd" />
        </span>
        <span
          data-dev
          className="hidden items-center gap-1.5 font-mono text-[10.5px] text-bone-3 md:flex"
          title="Event stream connection"
        >
          <StatusDot status={connection === "open" ? "live" : connection === "reconnecting" ? "warn" : "idle"} />
          {connection === "open" ? "stream open" : connection}
        </span>
        <span className="ml-auto">
          <DatasetBadge run={run} />
        </span>
      </div>
      <nav aria-label="Run" className="flex gap-1 overflow-x-auto border-line border-b">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-3 pt-2 pb-3 text-ui transition-colors duration-150",
                active ? "text-bone" : "text-bone-3 hover:text-bone-2",
              )}
            >
              {t.label}
              {t.count != null && <span className="font-mono text-[10.5px] text-bone-3">{t.count}</span>}
              {t.dot && <StatusDot status="warn" className="" />}
              {active && <span className="absolute inset-x-3 -bottom-px h-px bg-signal" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
