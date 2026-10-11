"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { keyframeUrls } from "@/components/blueprint/align";
import { ShotFrame } from "@/components/blueprint/Timeline";
import { useRunCtx } from "@/components/run/RunContext";
import { Badge, ComplianceBadge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Panel } from "@/components/ui/Panel";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { CHANNEL_LABELS, type Concept, type RenderTier, type RunEvent, type Shot } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { formatUsd } from "@/lib/client/format";
import { qk, useBrand, useConceptAssets } from "@/lib/client/queries";

const VIDEO_FORMATS = new Set([
  "ugc_talking_head",
  "faceless_broll",
  "product_demo",
  "founder_story",
  "listicle",
  "myth_vs_fact",
]);
const isVideo = (c: Concept) => VIDEO_FORMATS.has(c.format);
const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

export function Studio() {
  const { runId, revealed, events, run } = useRunCtx();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.concepts(runId),
    queryFn: () => getClient().concepts(runId),
    // while anything renders, poll so the player picks up the video without a manual refresh
    refetchInterval: (q) => (q.state.data?.some((c) => c.status === "rendering") ? 1500 : false),
  });
  const concepts = useMemo(() => (data ?? []).filter((c) => revealed.has(c.id)), [data, revealed]);
  const [selId, setSelId] = useState<string>();
  const sel = concepts.find((c) => c.id === selId) ?? concepts[0];
  const rendering = concepts.some((c) => c.status === "rendering");

  if (error) return <ErrorState title="Could not load the concepts" error={error} onRetry={() => refetch()} />;
  if (isLoading)
    return (
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={8} className="h-[420px]" />
      </div>
    );
  if (!concepts.length)
    return (
      <EmptyState
        title="No concepts yet"
        action={
          <Button asChild>
            <Link href={`/runs/${runId}`}>Back to the cockpit</Link>
          </Button>
        }
      >
        Concepts arrive after direction: each one remakes a proven structure for one of the chosen channels.
      </EmptyState>
    );

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav
          aria-label="Concepts"
          className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-44 lg:self-start"
          data-testid="concepts"
        >
          <p className="mono-label mb-1">{concepts.length} concepts / remakes of proven structures</p>
          {concepts.map((c) => (
            <ConceptCard key={c.id} c={c} active={c.id === sel?.id} onSelect={() => setSelId(c.id)} />
          ))}
        </nav>
        {sel && <Workbench key={sel.id} c={sel} events={events} demo={!!run?.demo} />}
      </div>
    </MotionConfig>
  );
}

function ConceptCard({ c, active, onSelect }: { c: Concept; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-current={active || undefined}
      data-testid={`concept-${c.id}`}
      className={cn(
        "glass-flat group flex flex-col gap-2.5 p-4 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-px",
        active && "shadow-[var(--shadow-panel-strong),inset_0_0_0_1px_rgb(229_50_45/0.45)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label truncate">
          {CHANNEL_LABELS[c.channel]} / {c.format.replaceAll("_", " ")}
        </span>
        <ComplianceBadge status={c.compliance} />
      </div>
      <p className="font-medium text-bone text-ui leading-snug">{c.title}</p>
      <p className="line-clamp-2 font-display text-[15px] text-bone-2 leading-snug">&ldquo;{c.hook}&rdquo;</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {c.blueprintId && !c.variantOf && <Badge tone="signal">Remake</Badge>}
        {c.variantOf && <Badge tone="cyan">Variant {c.aspect}</Badge>}
        <Badge>{c.status}</Badge>
        <span className="ml-auto font-mono text-[11px] text-bone-3">
          {c.estimatedCostUsd ? `est ${formatUsd(c.estimatedCostUsd)}` : "no render cost"}
        </span>
      </div>
    </button>
  );
}

function Workbench({ c, events, demo }: { c: Concept; events: RunEvent[]; demo: boolean }) {
  const { runId, run } = useRunCtx();
  const qc = useQueryClient();
  const { data: brand } = useBrand(run?.brandId);
  const { data: assets } = useConceptAssets(c.id);
  const [pendingShot, setPendingShot] = useState<number | null>(null);
  const [tier, setTier] = useState<RenderTier>("draft");
  const [quote, setQuote] = useState<{ usd: number; lines?: { provider: string; item: string; usd: number }[] }>();
  const [busy, setBusy] = useState(false);
  const keyframes = useMemo(() => keyframeUrls(assets, c.shots), [assets, c.shots]);
  const refs = referenceImages(brand);
  const video = assets?.find((a) => a.id === c.videoAssetId) ?? assets?.filter((a) => a.kind === "video").at(-1);
  const allApproved = c.shots.length > 0 && c.shots.every((s) => s.approved);
  const blocked = c.compliance === "fail";

  // when a render finishes, fetch its video asset
  useEffect(() => {
    if (c.status === "rendered") qc.invalidateQueries({ queryKey: qk.conceptAssets(c.id) });
  }, [c.status, c.id, qc]);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.concepts(runId) }),
      qc.invalidateQueries({ queryKey: qk.conceptAssets(c.id) }),
    ]);
  const approve = async (idx: number[]) => {
    try {
      await getClient().approveShots(c.id, idx);
      await refresh();
    } catch (e) {
      toast({ title: "Approval was not saved", body: e instanceof Error ? e.message : undefined, tone: "fail" });
    }
  };
  const regenerate = async (idx: number) => {
    setPendingShot(idx);
    try {
      await getClient().regenerateKeyframes(c.id, idx);
      await refresh();
      toast({ title: `Shot ${idx + 1} regenerated`, body: "Approve it again before rendering." });
    } catch (e) {
      toast({ title: "Regeneration failed", body: e instanceof Error ? e.message : undefined, tone: "fail" });
    } finally {
      setPendingShot(null);
    }
  };
  const render = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = (await getClient().render(c.id, { tier })) as {
        estimatedCostUsd: number;
        lines?: { provider: string; item: string; usd: number }[];
      };
      setQuote({ usd: res.estimatedCostUsd, lines: res.lines });
      await refresh();
      toast({
        title: `${tier === "final" ? "Final" : "Draft"} render started`,
        body: `Estimated ${formatUsd(res.estimatedCostUsd)}, logged to the spend ledger.`,
      });
    } catch (e) {
      toast({ title: "The render did not start", body: e instanceof Error ? e.message : undefined, tone: "fail" });
    } finally {
      setBusy(false);
    }
  };

  const checks = events.filter((e) => e.type === "compliance" && (e.data as { targetId?: string })?.targetId === c.id);

  return (
    <>
      <section aria-label={c.title} className="flex min-w-0 flex-col gap-5" data-testid="workbench">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{CHANNEL_LABELS[c.channel]}</Badge>
            <Badge>
              {c.format.replaceAll("_", " ")} / {c.aspect}
            </Badge>
            <Badge>{c.language}</Badge>
            {demo && <DemoBadge />}
            {c.blueprintId && (
              <Link
                href={`/runs/${runId}/blueprints/${c.blueprintId}`}
                className="ml-auto font-mono text-[11px] text-signal hover:underline"
              >
                See the winner it remakes
              </Link>
            )}
          </div>
          <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.04]">{c.title}</h2>
          <p className="font-display text-[20px] text-bone-2">&ldquo;{c.hook}&rdquo;</p>
          <p className="max-w-3xl text-bone-2 text-ui">
            <span className="mono-label mr-2">angle</span>
            {c.angle}
          </p>
          {c.remakeNote && (
            <p className="max-w-3xl border-line border-l pl-3 text-[12.5px] text-bone-3">{c.remakeNote}</p>
          )}
        </header>

        {c.shots.length > 0 && isVideo(c) ? (
          <Panel className="p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="mono-label">storyboard / keyframes first, then animate only what you approve</p>
              <Button
                size="sm"
                onClick={() => approve(c.shots.map((s) => s.idx))}
                disabled={allApproved}
                data-testid="approve-all"
              >
                {allApproved ? "All shots approved" : "Approve every shot"}
              </Button>
            </div>
            <ol className="flex gap-3 overflow-x-auto pb-2" data-testid="storyboard">
              {c.shots.map((s, i) => (
                <ShotCard
                  key={s.idx}
                  s={s}
                  i={i}
                  url={keyframes.get(s.idx)}
                  reference={!keyframes.get(s.idx) ? refs[i % Math.max(1, refs.length)] : undefined}
                  pending={pendingShot === s.idx}
                  onApprove={() => approve([s.idx])}
                  onRegenerate={() => regenerate(s.idx)}
                />
              ))}
            </ol>
          </Panel>
        ) : (
          <PostPreview c={c} image={keyframes.get(0) ?? refs[0]} imageIsRef={!keyframes.get(0)} />
        )}

        <Compliance checks={checks} status={c.compliance} revisions={c.revisions} />
      </section>

      <aside
        className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-44 xl:self-start lg:col-span-2 xl:col-span-1"
        aria-label="Render"
      >
        {isVideo(c) ? (
          <>
            <PhoneFrame
              src={video?.url}
              empty={c.status === "rendering" ? "Rendering" : "No render yet"}
              overlay={c.status === "rendering" ? <RenderProgress /> : undefined}
              className="max-w-[210px]"
            />
            <Panel tone="flat" className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <p className="mono-label">render</p>
                <Tabs
                  size="sm"
                  value={tier}
                  onValueChange={(v) => setTier(v as RenderTier)}
                  items={[
                    { value: "draft", label: "Draft" },
                    { value: "final", label: "Final" },
                  ]}
                />
              </div>
              <div>
                <p className="text-[10px] text-bone-3 uppercase tracking-[0.08em]">estimate before you render</p>
                <p className="mt-1 font-mono text-[26px] leading-none">
                  <NumberTicker
                    value={quote?.usd ?? (tier === "final" ? c.estimatedCostUsd : c.estimatedCostUsd * 0.25)}
                    format="usd"
                  />
                </p>
                {quote?.lines?.length ? (
                  <ul className="mt-2 flex flex-col gap-0.5 font-mono text-[10.5px] text-bone-3">
                    {quote.lines.map((l) => (
                      <li key={`${l.provider}${l.item}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {l.provider} / {l.item}
                        </span>
                        <span>{formatUsd(l.usd)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 font-mono text-[10.5px] text-bone-3">
                    {tier === "draft" ? "cheapest video tier, audio off" : "premium tier, only for the approved cut"}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                onClick={render}
                loading={busy}
                disabled={!allApproved || blocked || c.status === "rendering"}
                data-testid="render"
              >
                {c.status === "rendering" ? "Rendering" : `Render ${tier}`}
              </Button>
              <p className="font-mono text-[10.5px] text-bone-3" data-testid="render-hint">
                {blocked
                  ? "Blocked: compliance failed after two revisions. Edit the concept first."
                  : !allApproved
                    ? "Approve every shot first. Unapproved keyframes are never animated."
                    : c.status === "rendered"
                      ? "Rendered. The pack uses this video."
                      : "Every render goes through the spend ledger and its cap."}
              </p>
            </Panel>
          </>
        ) : (
          <Panel tone="hairline" className="p-4 text-bone-2 text-ui">
            {c.format === "text_post"
              ? "Text posts need no render. The pack carries the copy as written."
              : "Statics render as a single image at the aspect shown."}
          </Panel>
        )}
      </aside>
    </>
  );
}

function ShotCard({
  s,
  i,
  url,
  reference,
  pending,
  onApprove,
  onRegenerate,
}: {
  s: Shot;
  i: number;
  url?: string;
  reference?: string;
  pending: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-[150px] shrink-0 flex-col gap-2"
      data-testid={`shot-${i}`}
      data-approved={s.approved || undefined}
    >
      <div
        className={cn(
          "relative aspect-[9/16] overflow-hidden rounded-[10px] transition-shadow duration-300",
          s.approved ? "shadow-[0_0_0_1.5px_var(--color-signal)]" : "shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        )}
      >
        <ShotFrame
          url={url ?? reference}
          reference={!url && !!reference}
          fallback={s.visualPrompt}
          purpose="hook"
          className={cn("h-full w-full", pending && "opacity-30")}
        />
        {pending && <div className="skeleton absolute inset-0 rounded-none" />}
        <span className="absolute top-1.5 right-1.5 rounded-[4px] bg-ink/75 px-1 font-mono text-[10px] text-bone">
          {s.durationSec}s
        </span>
        {s.onScreenText && (
          <span className="absolute inset-x-1.5 bottom-1.5 line-clamp-2 rounded-[4px] bg-ink/70 px-1.5 py-1 text-[10.5px] leading-tight">
            {s.onScreenText}
          </span>
        )}
        {s.approved && (
          <span className="absolute inset-0 grid place-items-center bg-[rgb(17_17_17/0.25)]">
            <svg viewBox="0 0 24 24" className="size-10" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="#E5322D"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </span>
        )}
      </div>
      <p className="flex items-baseline justify-between gap-2 text-[11px] text-bone-3">
        <span className="font-mono">shot {i + 1}</span>
        {s.source && <span>{s.source === "brand_image" ? "your image, animated" : "new frame"}</span>}
      </p>
      <p className="line-clamp-3 text-[11.5px] text-bone-2 leading-snug" title={s.visualPrompt}>
        {s.voiceover ?? s.visualPrompt}
      </p>
      <div className="mt-auto flex gap-1">
        <button
          onClick={onApprove}
          disabled={s.approved || pending}
          aria-pressed={s.approved}
          className="flex-1 rounded-chip py-1 font-mono text-[10.5px] text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:bg-glass disabled:opacity-50 aria-pressed:text-signal"
        >
          {s.approved ? "approved" : "approve"}
        </button>
        <button
          onClick={onRegenerate}
          disabled={pending}
          aria-label={`Regenerate shot ${i + 1}`}
          className="rounded-chip px-2 py-1 font-mono text-[10.5px] text-bone-3 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-glass hover:text-bone disabled:opacity-50"
        >
          redo
        </button>
      </div>
    </motion.li>
  );
}

function PostPreview({ c, image, imageIsRef }: { c: Concept; image?: string; imageIsRef: boolean }) {
  const text = c.body ?? c.caption;
  const limit = c.channel === "x" ? 280 : undefined;
  return (
    <Panel className="p-5" data-testid="post-preview">
      <p className="mono-label mb-3">
        {c.format === "text_post" ? `${CHANNEL_LABELS[c.channel]} post, as it will read` : `${c.aspect} static`}
      </p>
      {c.format === "text_post" ? (
        <article className="max-w-2xl rounded-card bg-raised p-5 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <p className="whitespace-pre-line text-bone text-body leading-relaxed">{text}</p>
          {limit && (
            <p
              className={cn("mt-3 text-right font-mono text-[11px]", text.length > limit ? "text-fail" : "text-bone-3")}
            >
              {text.length} / {limit}
            </p>
          )}
        </article>
      ) : (
        <div className="flex flex-wrap gap-5">
          <div
            className={cn(
              "relative w-[260px] overflow-hidden rounded-[12px] shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
              ASPECT_CLASS[c.aspect],
            )}
          >
            <ShotFrame
              url={image}
              reference={imageIsRef}
              fallback={c.shots[0]?.visualPrompt ?? c.title}
              purpose="proof"
              className="h-full w-full"
            />
            {c.shots[0]?.onScreenText && (
              <span className="absolute inset-x-3 bottom-3 rounded-[6px] bg-ink/75 px-2 py-1.5 font-display text-[18px] leading-tight">
                {c.shots[0].onScreenText}
              </span>
            )}
          </div>
          <p className="max-w-sm text-bone-2 text-ui">{c.caption}</p>
        </div>
      )}
    </Panel>
  );
}

function Compliance({
  checks,
  status,
  revisions,
}: {
  checks: RunEvent[];
  status: Concept["compliance"];
  revisions?: number;
}) {
  return (
    <Panel tone="flat" className="p-5" data-testid="compliance">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label">compliance / the brand's rule pack</p>
        <ComplianceBadge status={status} />
      </div>
      {checks.length ? (
        <ol className="mt-3 flex flex-col gap-2">
          {checks.map((e) => {
            const d = e.data as { status?: string; attempt?: number };
            return (
              <li
                key={e.id}
                className="grid grid-cols-[64px_1fr] gap-3 border-line border-t pt-2 first:border-0 first:pt-0"
              >
                <span
                  className={cn(
                    "font-mono text-[10.5px] uppercase",
                    d.status === "pass" ? "text-pass" : d.status === "warn" ? "text-warn" : "text-fail",
                  )}
                >
                  {d.status} {d.attempt != null ? `#${d.attempt}` : ""}
                </span>
                <span className="text-[12.5px] text-bone-2">
                  {e.detail ?? (d.status === "pass" ? "Passed every rule in the pack." : e.title)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-[12.5px] text-bone-3">Not checked yet. Nothing renders or exports before it passes.</p>
      )}
      {revisions ? (
        <p className="mt-3 font-mono text-[10.5px] text-bone-3">
          auto-revised {revisions} time{revisions > 1 ? "s" : ""} to pass
        </p>
      ) : null}
    </Panel>
  );
}

function RenderProgress() {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[fill-up_2.6s_linear_infinite] bg-signal" />
    </div>
  );
}
