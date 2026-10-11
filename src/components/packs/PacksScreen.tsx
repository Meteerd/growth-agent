"use client";

import Link from "next/link";
import { PageHead } from "@/components/shell/PageHead";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CHANNEL_LABELS, type Channel, type MetricSnapshot, type PublishPack } from "@/contracts";
import { useFieldActivity } from "@/lib/client/field";
import { DATA_MODE } from "@/lib/client/mode";
import { PRODUCT_NAME } from "@/lib/client/product";
import { useConcepts, usePacks, useResults, useRun } from "@/lib/client/queries";
import { PackCard } from "./PackCard";

export function PacksScreen({ runId }: { runId: string }) {
  const packs = usePacks(runId);
  const { data: run } = useRun(runId);
  const concepts = useConcepts(runId);
  const list = packs.data ?? [];
  // Latest stored snapshot per pack, so posted packs keep their numbers across reloads (live mode).
  const { data: results } = useResults(list[0]?.brandId);
  useFieldActivity(0.2);

  const demo = !!run?.demo || DATA_MODE === "mock";
  const conceptById = new Map((concepts.data ?? []).map((c) => [c.id, c]));
  const latest = new Map<string, MetricSnapshot | undefined>(
    (results?.packs ?? []).map((p) => [
      p.id,
      p.snapshots.reduce<MetricSnapshot | undefined>((a, s) => (!a || s.capturedAt > a.capturedAt ? s : a), undefined),
    ]),
  );
  const groups = new Map<Channel, PublishPack[]>();
  for (const p of list) groups.set(p.platform, [...(groups.get(p.platform) ?? []), p]);
  const order = new Map(list.map((p, i) => [p.id, i + 1]));
  const posted = list.filter((p) => p.status === "posted").length;

  return (
    <div>
      <PageHead className="pt-2 md:pt-4" eyebrow="Packs / ready to post" title="Ready to post.">
        Each pack holds the file, the caption, the hashtags and a checklist. You post it; {PRODUCT_NAME} never posts.
      </PageHead>

      <section
        aria-label="How posting works"
        className="rise glass-flat mb-12 grid overflow-hidden md:grid-cols-[minmax(0,1fr)_auto]"
        style={{ animationDelay: "180ms" }}
      >
        <div className="flex gap-4 p-5 md:p-6">
          <span
            aria-hidden
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] text-warn shadow-[inset_0_0_0_1px_rgb(255_200_92/0.35)]"
          >
            !
          </span>
          <div>
            <p className="mono-label">Why there is no post button</p>
            <p className="mt-2 max-w-[68ch] text-bone-2 text-ui">
              TikTok and YouTube keep API uploads from an unaudited app private, so a post sent from here would reach
              nobody. Download the pack and post it by hand or from the platform's own app, then paste the link here.
            </p>
          </div>
        </div>
        {!packs.error && (
          <dl className="grid grid-cols-3 border-line border-t md:border-t-0 md:border-l">
            <Count label="packs" value={packs.data && list.length} />
            <Count label="platforms" value={packs.data && groups.size} />
            <Count label="posted" value={packs.data && posted} />
          </dl>
        )}
      </section>

      {packs.error ? (
        <ErrorState title="Could not load the packs" error={packs.error} onRetry={() => packs.refetch()} />
      ) : packs.isLoading || concepts.isLoading ? (
        <LoadingGroups />
      ) : !list.length ? (
        <EmptyState
          title="No packs yet"
          action={
            <Button variant="primary" asChild>
              <Link href={`/runs/${runId}`}>Open the run cockpit</Link>
            </Button>
          }
        >
          A pack appears here once its concept passes the compliance check for this brand's rule pack. Follow the run in
          the cockpit until then.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-16" data-testid="pack-groups">
          {[...groups].map(([platform, items], gi) => {
            const done = items.filter((p) => p.status === "posted").length;
            return (
              <section
                key={platform}
                aria-labelledby={`group-${platform}`}
                data-testid={`pack-group-${platform}`}
                className="grid gap-5 border-line border-t pt-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8"
              >
                <header className="rise flex items-end justify-between gap-4 lg:sticky lg:top-24 lg:flex-col lg:items-start lg:justify-start lg:self-start">
                  <div>
                    <p className="font-mono text-[11px] text-bone-3 tabular-nums">{String(gi + 1).padStart(2, "0")}</p>
                    <h2 id={`group-${platform}`} className="mt-2 font-serif text-[32px] leading-none md:text-[36px]">
                      {CHANNEL_LABELS[platform]}
                    </h2>
                  </div>
                  <p className="font-mono text-[11px] text-bone-3 tabular-nums lg:mt-3">
                    {items.length} {items.length === 1 ? "pack" : "packs"} / {done} posted
                  </p>
                </header>
                <ul className="flex min-w-0 flex-col gap-4">
                  {items.map((p) => {
                    const n = order.get(p.id) ?? 0;
                    return (
                      <li key={p.id} className="rise" style={{ animationDelay: `${160 + n * 60}ms` }}>
                        <PackCard
                          pack={p}
                          n={n}
                          concept={conceptById.get(p.conceptId)}
                          runId={runId}
                          demo={demo}
                          snapshot={latest.get(p.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Count({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex flex-col justify-center gap-1 border-line px-5 py-4 [&+&]:border-l md:min-w-[112px]">
      <dt className="mono-label">{label}</dt>
      <dd className="text-bone text-heading">
        {value === undefined ? <Skeleton className="my-1 h-5 w-8" /> : <NumberTicker value={value} />}
      </dd>
    </div>
  );
}

function LoadingGroups() {
  return (
    <div className="grid gap-5 border-line border-t pt-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-6" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="glass-flat grid overflow-hidden md:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_316px]"
          >
            <div className="grid place-items-center border-line border-b p-5 md:border-r md:border-b-0">
              <Skeleton className="aspect-[9/16] w-full max-w-[192px] rounded-card" />
            </div>
            <div className="flex flex-col gap-3 p-6" role="status" aria-busy="true" aria-label="Loading packs">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-7 w-3/4" />
              {[92, 84, 70, 40].map((w) => (
                <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />
              ))}
              <div className="mt-4 flex gap-2">
                {[0, 1, 2, 3].map((t) => (
                  <Skeleton key={t} className="h-6 w-20 rounded-chip" />
                ))}
              </div>
            </div>
            <div className="hidden flex-col gap-3 border-line border-l p-6 xl:flex">
              <Skeleton className="h-3 w-24" />
              {[80, 90, 70, 85].map((w) => (
                <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />
              ))}
              <Skeleton className="mt-auto h-10 rounded-chip" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
