"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { PROVIDER_INFO, type SpendEntry, type SpendResponse } from "@/contracts";
import { formatCount, formatUsd, timeAgo } from "@/lib/client/format";
import { DATA_MODE } from "@/lib/client/mode";

const exact = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Newest first, whatever order the engine returns (it returns oldest first). */
const newestFirst = (entries: SpendEntry[]) => [...entries].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

// Engine ids are <prefix>_<ms base36><random hex>: the head is near-identical across runs, so keep prefix + tail.
const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, id.indexOf("_") + 1)}…${id.slice(-6)}` : id);

const TH = "px-4 py-3 text-left font-normal mono-label";
// Below md each row is a two-column grid card; from md up it is a real table row.
const TR =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-line border-b px-4 py-4 last:border-b-0 md:table-row md:p-0";
const TD = "md:px-4 md:py-3.5 md:align-top";

export function SpendLedger({ spend, loading }: { spend?: SpendResponse; loading: boolean }) {
  if (loading || !spend)
    return (
      <div className="glass-flat flex flex-col gap-px overflow-hidden p-2" role="status" aria-busy="true">
        <span className="sr-only">Loading the spend ledger</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-6 px-3 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="hidden h-3 w-28 md:block" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );

  if (!spend.entries.length)
    return (
      <div data-testid="ledger-empty">
        <EmptyState
          title="No paid calls yet"
          action={
            <Button size="sm" asChild>
              <Link href="/brands">Open the portfolio</Link>
            </Button>
          }
        >
          {DATA_MODE === "mock"
            ? "Mock mode calls no provider, so nothing is charged. In live mode every paid call lands here with its provider, run and cost."
            : "When the engine makes a live call it lands here with its provider, run and cost."}
        </EmptyState>
      </div>
    );

  const rows = newestFirst(spend.entries);
  const total = spend.totalUsd ?? rows.reduce((a, e) => a + e.usd, 0);
  return (
    <div className="glass-flat overflow-hidden" data-testid="spend-ledger">
      <table className="w-full border-collapse text-ui">
        <caption className="sr-only">Spend ledger, newest first</caption>
        <thead className="hidden bg-[rgb(255_255_255/0.02)] md:table-header-group">
          <tr className="border-line border-b">
            <th scope="col" className={TH}>
              time
            </th>
            <th scope="col" className={TH}>
              provider
            </th>
            <th scope="col" className={TH}>
              run
            </th>
            <th scope="col" className={TH}>
              units
            </th>
            <th scope="col" className={TH}>
              note
            </th>
            <th scope="col" className={`${TH} text-right`}>
              usd
            </th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {rows.map((e, i) => (
            <tr
              key={e.id}
              className={`${TR} rise transition-colors duration-150 hover:bg-glass`}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <td className={`${TD} order-4 whitespace-nowrap`}>
                <time dateTime={e.ts} title={exact.format(new Date(e.ts))} className="font-mono text-bone-2">
                  {timeAgo(e.ts)}
                </time>
                <span className="ml-2 font-mono text-[11px] text-bone-3 tabular-nums md:mt-0.5 md:ml-0 md:block">
                  {exact.format(new Date(e.ts))}
                </span>
              </td>
              <td className={`${TD} order-1 font-medium text-bone`}>
                {PROVIDER_INFO[e.provider]?.label ?? e.provider}
              </td>
              <td className={`${TD} order-5 text-right font-mono text-[11px] text-bone-3 md:text-left`}>
                {e.runId ? <span title={e.runId}>{shortId(e.runId)}</span> : <span>no run</span>}
              </td>
              <td className={`${TD} order-6 col-span-2 font-mono text-[11px] text-bone-2 max-md:empty:hidden`}>
                {e.units}
              </td>
              <td className={`${TD} order-3 col-span-2 text-bone-2`}>{e.note}</td>
              <td className={`${TD} order-2 text-right font-mono text-bone tabular-nums`}>{formatUsd(e.usd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="block border-line border-t bg-[rgb(255_255_255/0.02)] md:table-footer-group">
          <tr className="flex items-baseline justify-between gap-4 px-4 py-4 md:table-row md:p-0">
            <td colSpan={5} className="mono-label md:px-4 md:py-4">
              total, {formatCount(rows.length)} {rows.length === 1 ? "call" : "calls"}
            </td>
            <td className="text-right font-mono text-bone text-heading tabular-nums md:px-4 md:py-4">
              {formatUsd(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
