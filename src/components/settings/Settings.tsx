"use client";

import { useEffect, useState } from "react";
import { Page, PageHead } from "@/components/shell/PageHead";
import { Badge, DemoBadge, StatusDot } from "@/components/ui/Badge";
import { CostMeter } from "@/components/ui/CostMeter";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { ProviderTile } from "@/components/ui/ProviderTile";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import {
  PROVIDER_IDS,
  PROVIDER_INFO,
  type ProviderId,
  type ProviderInfo,
  type ProviderStatus,
  type SpendResponse,
} from "@/contracts";
import { cn } from "@/lib/client/cn";
import { formatCount, formatUsd } from "@/lib/client/format";
import { DATA_MODE } from "@/lib/client/mode";
import { useProviders, useSpend } from "@/lib/client/queries";
import { SpendLedger } from "./SpendLedger";

type Row = { id: ProviderId; info: ProviderInfo; status?: ProviderStatus };

const GROUPS: { role: ProviderInfo["role"]; title: string; blurb: string }[] = [
  {
    role: "engine",
    title: "Engines",
    blurb: "Claude makes every decision. OpenAI makes images and voice. Manus runs deep research and landing pages.",
  },
  { role: "tool", title: "Tools", blurb: "Called by the engines for evidence, sites and video." },
  { role: "connector", title: "Connectors", blurb: "The brand's own numbers, read-only, connected per brand." },
];

const totalSpend = (s?: SpendResponse) =>
  s ? (s.totalUsd ?? Object.values(s.byProvider).reduce<number>((a, v) => a + (v ?? 0), 0)) : 0;

/** One row per provider in PROVIDER_IDS; a provider the API did not report has no status (shown as Missing). */
function mergeProviders(statuses?: ProviderStatus[]): Row[] {
  const byId = new Map(statuses?.map((s) => [s.provider, s]));
  return PROVIDER_IDS.map((id) => ({ id, info: PROVIDER_INFO[id], status: byId.get(id) }));
}

export function Settings() {
  const providers = useProviders();
  const spend = useSpend();
  const rows = mergeProviders(providers.data);
  const live = rows.filter((r) => r.status?.mode === "live");
  const ready = !providers.isLoading && !providers.error;
  const pending = providers.error ? <span className="text-bone-3">n/a</span> : <Skeleton className="h-6 w-8" />;

  return (
    <Page>
      <PageHead
        eyebrow="Providers / spend"
        title="What runs live, and what it costs."
        actions={
          <dl className="flex w-full overflow-hidden rounded-card border border-line bg-raised md:w-auto">
            <Readout label="live">
              {ready ? (
                <span className="flex items-center gap-2">
                  <StatusDot status={live.length ? "live" : "idle"} />
                  {live.length}
                </span>
              ) : (
                pending
              )}
            </Readout>
            <Readout label="demo">{ready ? rows.filter((r) => r.status?.mode === "demo").length : pending}</Readout>
            <Readout label="spent">
              {spend.data ? (
                <NumberTicker value={totalSpend(spend.data)} format="usd" from={0} />
              ) : spend.error ? (
                <span className="text-bone-3">n/a</span>
              ) : (
                <Skeleton className="h-6 w-16" />
              )}
            </Readout>
          </dl>
        }
      >
        A provider is live only when its key is present and it is listed in LIVE_PROVIDERS. Everything else runs on
        labelled demo data, and every paid call is capped.
      </PageHead>

      <ModePanel live={live} loading={providers.isLoading} failed={!!providers.error} />

      <Section
        index="01"
        eyebrow={`${PROVIDER_IDS.length} providers`}
        title="Providers"
        id="providers"
        lede="Scarce means a small credit balance: demo by default, with one recorded smoke test and one real-data pass."
      >
        {providers.error ? (
          <ErrorState
            title="Could not read provider status"
            error={providers.error}
            onRetry={() => providers.refetch()}
          />
        ) : (
          <div data-testid="provider-grid">
            {GROUPS.map((g) => (
              <ProviderGroup
                key={g.role}
                {...g}
                rows={rows.filter((r) => r.info.role === g.role)}
                loading={providers.isLoading}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        index="02"
        eyebrow="caps vs spent"
        title="Budgets"
        id="budgets"
        lede="Caps come from the BUDGET_ variables in .env. A live call that would pass its cap is refused, and that step continues on demo data."
      >
        {providers.error || spend.error ? (
          <ErrorState
            title="Could not read budgets"
            error={providers.error ?? spend.error}
            onRetry={() => {
              providers.refetch();
              spend.refetch();
            }}
          />
        ) : (
          <Budgets rows={rows} spend={spend.data} loading={providers.isLoading || spend.isLoading} />
        )}
      </Section>

      <Section
        index="03"
        eyebrow={spend.data ? `${formatCount(spend.data.entries.length)} entries` : "entries"}
        title="Spend ledger"
        id="ledger"
        lede="Every paid provider call, newest first, with the run that made it."
      >
        {spend.error ? (
          <ErrorState title="Could not read the spend ledger" error={spend.error} onRetry={() => spend.refetch()} />
        ) : (
          <SpendLedger spend={spend.data} loading={spend.isLoading} />
        )}
      </Section>
    </Page>
  );
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[88px] flex-1 border-line border-l px-4 py-3 first:border-l-0 sm:min-w-[104px]">
      <dt className="mono-label">{label}</dt>
      <dd className="mt-1.5 flex h-7 items-center font-mono text-bone text-heading tabular-nums">{children}</dd>
    </div>
  );
}

function Section({
  index,
  eyebrow,
  title,
  id,
  lede,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  id: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="mt-16 md:mt-24">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
        <div>
          <p className="mono-label">
            <span className="text-bone-3">{index}</span> / {eyebrow}
          </p>
          <h2 id={`${id}-title`} className="mt-2 font-display text-[32px] leading-[1.05] md:text-[40px]">
            {title}
          </h2>
        </div>
        {lede && <p className="max-w-md text-bone-2 text-ui md:text-right">{lede}</p>}
      </header>
      {children}
    </section>
  );
}

/** Read-only: which data the cockpit shows, and the rule that makes a provider live. Never touches keys. */
function ModePanel({ live, loading, failed }: { live: Row[]; loading: boolean; failed: boolean }) {
  const mock = DATA_MODE === "mock";
  return (
    <section
      aria-label="Modes"
      data-testid="mode-panel"
      className="glass rise grid overflow-hidden md:grid-cols-[1fr_1.25fr_1fr]"
    >
      <Cell label="This cockpit">
        <div className="flex items-center gap-3">
          <p className="font-display text-[30px] leading-none">{mock ? "Mock" : "Live engine"}</p>
          {mock ? <DemoBadge label="Mock data" /> : <Badge tone="pass">/api</Badge>}
        </div>
        <p className="mt-3 text-bone-2 text-ui">
          {mock
            ? "In-browser fixtures. Nothing leaves this tab and every number on screen is demo data."
            : "Reads the engine API on this machine. Statuses and spend below come from it."}
        </p>
      </Cell>

      <Cell label="Provider modes">
        <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-bone-2">
          <Token>key present</Token>
          <span aria-hidden>+</span>
          <Token>
            in <code className="ml-1 font-mono text-[11px]">LIVE_PROVIDERS</code>
          </Token>
          <span aria-hidden>=</span>
          <Badge tone="pass">Live</Badge>
          <span className="text-bone-3">otherwise</span>
          <DemoBadge label="Demo" />
        </p>
        <p className="mt-3 text-bone-2 text-ui">
          Set in .env on the engine machine. Read-only here: this screen never shows, stores or asks for keys.
        </p>
      </Cell>

      <Cell label="Live right now">
        {loading ? (
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-20 rounded-chip" />
            <Skeleton className="h-6 w-16 rounded-chip" />
          </div>
        ) : failed ? (
          <p className="text-[12.5px] text-bone-3">Unknown: provider status did not load.</p>
        ) : live.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {live.map((r) => (
              <li key={r.id}>
                <Badge tone="pass">
                  <StatusDot status="live" />
                  {r.info.label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-bone-2 text-ui">
            None. {mock ? "Mock mode calls no provider." : "Every provider is on demo data."}
          </p>
        )}
      </Cell>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-line border-t p-5 first:border-t-0 md:border-t-0 md:border-l md:p-6 md:first:border-l-0">
      <p className="mono-label mb-4">{label}</p>
      {children}
    </div>
  );
}

function Token({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-cell border border-line-strong bg-raised-2 px-2 text-bone">
      {children}
    </span>
  );
}

function ProviderGroup({
  role,
  title,
  blurb,
  rows,
  loading,
}: {
  role: string;
  title: string;
  blurb: string;
  rows: Row[];
  loading: boolean;
}) {
  const live = rows.filter((r) => r.status?.mode === "live").length;
  return (
    <section
      aria-labelledby={`group-${role}`}
      className="grid gap-5 border-line border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_1fr] md:gap-8"
    >
      <header className="md:pt-1">
        <h3 id={`group-${role}`} className="font-medium text-bone text-heading">
          {title}
        </h3>
        <p className="mt-2 text-bone-2 text-ui">{blurb}</p>
        <p className="mt-3 text-[12px] text-bone-3 tabular-nums">
          {loading ? "Reading status" : `${live} of ${rows.length} live`}
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className="rise" data-testid={`provider-${r.id}`}>
            {loading ? <SkeletonCard lines={2} className="h-full min-h-[208px]" /> : <Tile row={r} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ row: { id, info, status: s } }: { row: Row }) {
  return (
    <ProviderTile
      label={info.label}
      usedFor={info.usedFor}
      kind={id}
      status={s ? s.mode : "missing"}
      note={s ? s.note : "Not reported by the engine."}
      className="h-full"
    >
      <dl className="mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-card bg-line">
        <Fact label="key" on={s?.keyPresent}>
          {s ? (s.keyPresent ? "yes" : "no") : "unknown"}
        </Fact>
        <Fact label="verified" on={s?.verified}>
          {s ? (s.verified ? "yes" : "no") : "unknown"}
        </Fact>
        <Fact label="scarce" on={info.scarce} warn>
          {info.scarce ? "yes" : "no"}
        </Fact>
      </dl>
    </ProviderTile>
  );
}

function Fact({ label, on, warn, children }: { label: string; on?: boolean; warn?: boolean; children: string }) {
  return (
    <div className="bg-raised px-3 py-2.5">
      <dt className="mono-label text-[10px]">{label}</dt>
      <dd
        className={cn(
          "mt-1 flex items-center gap-1.5 text-ui",
          on ? (warn ? "text-warn" : "text-bone") : "text-bone-3",
        )}
      >
        <span aria-hidden className={cn("size-1 rounded-full", on ? "bg-current" : "bg-bone-4")} />
        {children}
      </dd>
    </div>
  );
}

/** Paid providers only (connectors read brand data and cost nothing). Manus caps are credits, not USD. */
function Budgets({ rows, spend, loading }: { rows: Row[]; spend?: SpendResponse; loading: boolean }) {
  const paid = rows.filter((r) => r.info.role !== "connector");
  // Bars fill to their value once after mount (DESIGN motion plan).
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (loading) return;
    const t = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(t);
  }, [loading]);

  return (
    <div
      className="grid overflow-hidden rounded-panel border border-line bg-raised lg:grid-cols-[300px_1fr]"
      data-testid="budgets"
    >
      <div className="flex flex-col justify-between gap-6 border-line border-b p-6 lg:border-r lg:border-b-0">
        <div>
          <p className="mono-label">total spent</p>
          <div className="mt-3 font-mono text-[52px] text-bone leading-none tracking-[-0.02em] tabular-nums">
            {loading || !spend ? (
              <Skeleton className="h-[52px] w-40" />
            ) : (
              <NumberTicker value={totalSpend(spend)} format="usd" from={0} duration={1.1} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[12px] text-bone-3 tabular-nums">
          <p>
            {spend
              ? `USD across ${formatCount(spend.entries.length)} paid ${spend.entries.length === 1 ? "call" : "calls"}`
              : "USD, from the spend ledger"}
          </p>
          {!loading && (
            <p>
              caps set for {paid.filter((r) => r.status?.budgetUsd !== undefined).length} of {paid.length} paid
              providers
            </p>
          )}
        </div>
      </div>
      <ul className="grid gap-px bg-line sm:grid-cols-3">
        {paid.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 bg-raised p-4 sm:min-h-[148px] sm:gap-4 sm:p-5"
            data-testid={`budget-${r.id}`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-bone text-ui">{r.info.label}</p>
              {r.info.budgetEnv && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-bone-3">{r.info.budgetEnv}</p>
              )}
            </div>
            {loading ? (
              <div className="mt-auto flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-1.5" />
              </div>
            ) : (
              <BudgetLine row={r} spentUsd={r.status?.spentUsd ?? spend?.byProvider[r.id] ?? 0} filled={filled} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BudgetLine({ row, spentUsd, filled }: { row: Row; spentUsd: number; filled: boolean }) {
  const cap = row.status?.budgetUsd;
  if (cap !== undefined && row.info.budgetEnv?.includes("CREDITS"))
    return (
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="flex items-baseline justify-between font-mono text-ui">
          <span className="mono-label">cap</span>
          <span className="text-bone tabular-nums">{formatCount(cap)} credits</span>
        </p>
        <p className="text-[12px] text-bone-3">Metered by Manus in credits, not in USD.</p>
      </div>
    );
  if (cap !== undefined)
    return <CostMeter label="spent" spentUsd={filled ? spentUsd : 0} capUsd={cap} className="mt-auto" />;
  return (
    <div className="mt-auto flex flex-col gap-2">
      <p className="flex items-baseline justify-between font-mono text-ui">
        <span className="mono-label">spent</span>
        <span className="text-bone tabular-nums">{formatUsd(spentUsd)}</span>
      </p>
      <p className="border-line border-t border-dashed pt-2 text-[12px] text-bone-3">No cap set</p>
    </div>
  );
}
