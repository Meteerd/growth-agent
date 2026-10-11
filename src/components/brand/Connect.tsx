"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProviderTile } from "@/components/ui/ProviderTile";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { type Connection, PROVIDER_IDS, PROVIDER_INFO, type ProviderId, type ProviderStatus } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { qk, useAction, useBrand, useConnections, useProviders } from "@/lib/client/queries";

// What each connection adds, in plain words, and the non-secret id the engine needs per brand.
const ADDS: Partial<Record<ProviderId, { adds: string; field?: { key: string; label: string; placeholder: string } }>> =
  {
    anthropic: { adds: "Every decision: intake, research reasoning, the consultation, channels, scripts, compliance." },
    openai: { adds: "Keyframes, voiceover and transcription of winning videos." },
    manus: { adds: "A deep-research task per run that maps the market and cites its sources." },
    firecrawl: { adds: "Reads your site and your competitors' sites." },
    apify: { adds: "Meta Ad Library, TikTok, Instagram, Reddit and reviews when Spiral does not cover them." },
    spiral: {
      adds: "Winning Meta and TikTok ads with transcripts and creative analysis.",
      field: { key: "brandId", label: "Spiral brand id", placeholder: "brand_123" },
    },
    youtube: {
      adds: "YouTube Shorts outliers in your niche.",
      field: { key: "channelId", label: "Your channel id (optional)", placeholder: "UC..." },
    },
    fal: { adds: "Image-to-video for approved keyframes." },
    higgsfield: { adds: "Premium video tier for final renders." },
    revenuecat: {
      adds: "Trial-to-paid and revenue by country, so channels are judged on money, not views.",
      field: { key: "projectId", label: "RevenueCat project id", placeholder: "proj_..." },
    },
    posthog: {
      adds: "Funnel steps and top referrers.",
      field: { key: "projectId", label: "PostHog project id", placeholder: "12345" },
    },
    stripe: {
      adds: "Paying customers by country and plan.",
      field: { key: "accountId", label: "Stripe account id", placeholder: "acct_..." },
    },
    paddle: {
      adds: "Paying customers by country and plan.",
      field: { key: "vendorId", label: "Paddle seller id", placeholder: "12345" },
    },
    meta: {
      adds: "Your own ad spend and cost per result by creative.",
      field: { key: "adAccountId", label: "Meta ad account id", placeholder: "act_..." },
    },
    instagram: {
      adds: "Post insights after you publish, read by API instead of typed in.",
      field: { key: "accountId", label: "Instagram business account id", placeholder: "1784..." },
    },
  };

const ROLE_TITLE = { engine: "Engines", tool: "Tools", connector: "Your business data" } as const;

export function Connect({ slug }: { slug: string }) {
  const { data: brand } = useBrand(slug);
  const { data: conns, isLoading, error, refetch } = useConnections(brand?.id);
  const { data: providers } = useProviders();
  const global = new Map((providers ?? []).map((p) => [p.provider, p]));
  if (error) return <ErrorState title="Could not load connections" error={error} onRetry={() => refetch()} />;
  const byProvider = new Map((conns ?? []).map((c) => [c.provider, c]));
  return (
    <div className="flex flex-col gap-10">
      <p className="max-w-2xl text-bone-2 text-body">
        Every connection is optional. With none, the loop still runs on public data and labelled demo data. Each one
        makes the output sharper. Keys live in the engine&apos;s .env and are never entered here; this page only takes
        the ids that say which account to read.
      </p>
      {(["engine", "tool", "connector"] as const).map((role) => (
        <section key={role} aria-labelledby={`role-${role}`}>
          <h2 id={`role-${role}`} className="mb-4 font-display text-[28px]">
            {ROLE_TITLE[role]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid={`providers-${role}`}>
            {PROVIDER_IDS.filter((p) => PROVIDER_INFO[p].role === role).map((p) =>
              isLoading || !brand ? (
                <SkeletonCard key={p} lines={2} />
              ) : (
                <Tile
                  key={p}
                  provider={p}
                  brandId={brand.id}
                  conn={byProvider.get(p) ?? globalConn(p, global.get(p))}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Engines and tools are global (keys in the engine's .env): their tile mirrors /api/providers, never "Missing". */
function globalConn(p: ProviderId, st?: ProviderStatus): Connection | undefined {
  if (!st || PROVIDER_INFO[p].role === "connector") return undefined;
  return {
    id: `global_${p}`,
    brandId: "",
    provider: p,
    status: st.mode === "live" ? "live" : "demo",
    config: {},
    summary:
      st.mode === "live"
        ? "Live for every brand"
        : st.keyPresent
          ? "Key present, runs on demo data"
          : "No key: labelled demo data",
  };
}

function Tile({ provider, brandId, conn }: { provider: ProviderId; brandId: string; conn?: Connection }) {
  const info = PROVIDER_INFO[provider];
  const extra = ADDS[provider];
  const status = conn?.status ?? "missing";
  const field = extra?.field;
  const [value, setValue] = useState(field ? (conn?.config[field.key] ?? "") : "");
  const save = useAction(
    (v: string) => getClient().connect(brandId, { provider, config: field ? { [field.key]: v.trim() } : {} }),
    () => [qk.connections(brandId)],
  );
  return (
    <ProviderTile
      kind={info.scarce ? `${info.role} / scarce` : info.role}
      label={info.label}
      usedFor={extra?.adds ?? info.usedFor}
      status={status}
      note={conn?.error ?? conn?.summary ?? (status === "missing" ? "Not connected for this brand" : undefined)}
    >
      {field && (
        <form
          className="mt-auto flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await save.mutateAsync(value);
            toast({ title: `${info.label} saved`, body: "The next run reads this account.", tone: "pass" });
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="mono-label">{field.label}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field.placeholder}
              spellCheck={false}
              autoComplete="off"
              className="h-9 min-w-0 rounded-chip bg-glass px-3 font-mono text-[12px] text-bone outline-none shadow-[inset_0_0_0_1px_var(--color-line-strong)] placeholder:text-bone-4 focus:shadow-[inset_0_0_0_1px_rgb(229_50_45/0.5)]"
            />
          </label>
          <Button size="sm" type="submit" loading={save.isPending} disabled={!value.trim()}>
            Save
          </Button>
        </form>
      )}
    </ProviderTile>
  );
}
