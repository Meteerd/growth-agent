"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRunCtx } from "@/components/run/RunContext";
import { Badge, ComplianceBadge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Panel } from "@/components/ui/Panel";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { type Blueprint, CHANNEL_LABELS, type Concept, type Review, type Shot } from "@/contracts";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { useFieldActivity } from "@/lib/client/field";
import { formatCount, SOURCE_LABELS } from "@/lib/client/format";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";
import { useBlueprint, useBrand, useConceptAssets, useConceptReviews, useConcepts } from "@/lib/client/queries";
import { alignRemake, keyframeUrls, latestReview, nearestFrame, scoreTone, shotAt, shotScore } from "./align";
import { ShotFrame, Timeline } from "./Timeline";

const SCAN_MS = 5200;

export function BlueprintView({ blueprintId }: { blueprintId: string }) {
  const { runId, run } = useRunCtx();
  const { data: bp, isLoading, error, refetch } = useBlueprint(blueprintId);
  const { data: concepts } = useConcepts(runId);
  const { data: brand } = useBrand(run?.brandId);
  const remake = concepts?.find((c) => c.blueprintId === blueprintId && !c.variantOf);
  const variants = concepts?.filter((c) => remake && c.variantOf === remake.id) ?? [];
  const { data: assets } = useConceptAssets(remake?.id);
  const { data: reviews } = useConceptReviews(remake?.id);
  const [scanning, setScanning] = useState(false);
  const [t, setT] = useState(0);
  useFieldActivity(scanning ? 0.7 : 0.3, "signal");

  // the agent "watches": one sweep of the scan line on arrival (skipped for reduced motion)
  const raf = useRef(0);
  const scan = () => {
    if (!bp || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(raf.current);
    setScanning(true);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / SCAN_MS);
      setT(p * (bp.durationSec - 0.001));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        setScanning(false);
        setT(Math.min(bp.hook.endSec / 2, bp.durationSec - 0.001));
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: start the sweep once, when the blueprint arrives
  useEffect(() => {
    if (bp) scan();
    return () => cancelAnimationFrame(raf.current);
  }, [bp?.id]);

  const aligned = useMemo(() => (bp ? alignRemake(bp, remake) : []), [bp, remake]);
  const keyframes = useMemo(() => keyframeUrls(assets, remake?.shots), [assets, remake]);
  const review = latestReview(reviews);

  if (error)
    return (error as { status?: number }).status === 404 || /not found/i.test(String((error as Error).message)) ? (
      <NoBlueprint runId={runId} />
    ) : (
      <ErrorState title="Could not load the blueprint" error={error} onRetry={() => refetch()} />
    );
  if (isLoading || !bp)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-panel" />
        <Skeleton className="h-[440px] rounded-panel" />
      </div>
    );

  const ev = bp.evidence;
  const idx = Math.max(0, shotAt(bp.shots, t));
  const shot = bp.shots[idx];
  const ours = aligned[idx];
  const refs = remake ? referenceImages(brand) : [];

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-5" data-testid="blueprint-view">
        {/* the winner and why it wins */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0 pt-2">
            <p className="rise mono-label">
              reverse-engineer / {ev ? `${SOURCE_LABELS[ev.source]} ${ev.kind}` : "winning video"}
              {ev?.author ? ` / ${ev.author}` : ""}
            </p>
            <h1
              className="rise mt-2 font-serif text-[clamp(2rem,3.6vw,3rem)] leading-[1.02] tracking-[-0.012em]"
              style={{ animationDelay: "60ms" }}
            >
              We watched it.{" "}
              <span className="text-bone-3 italic">Then rebuilt it for {brand?.name ?? "the brand"}.</span>
            </h1>
            {ev && (
              <p className="rise mt-4 max-w-2xl text-bone-2 text-body" style={{ animationDelay: "120ms" }}>
                &ldquo;{ev.title}&rdquo;
              </p>
            )}
            <dl className="rise mt-4 flex flex-wrap gap-x-7 gap-y-2 font-mono" style={{ animationDelay: "160ms" }}>
              {ev?.metrics.views != null && <Stat k="views" v={formatCount(ev.metrics.views)} />}
              {ev?.metrics.outlierScore != null && (
                <Stat k="vs account median" v={`${ev.metrics.outlierScore.toFixed(1)}x`} accent />
              )}
              {ev?.metrics.daysRunning != null && (
                <Stat k="running" v={`${ev.metrics.daysRunning} days`} accent={ev.metrics.daysRunning >= 30} />
              )}
              <Stat k="structure" v={bp.structure.replaceAll("_", " ")} />
              <Stat k="pacing" v={`${bp.pacing.cutsPer10s} cuts / 10s`} />
              <Stat k="arc" v={bp.emotionalArc.replaceAll("->", "→")} />
            </dl>
          </div>
          <Panel className="rise self-start p-5" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between gap-3">
              <p className="mono-label">why it wins</p>
              {bp.demo && <DemoBadge />}
            </div>
            <p className="mt-2 font-serif text-[18px] leading-snug">{bp.whyItWins}</p>
            <p className="mt-3 border-line border-t pt-2.5 font-mono text-[10px] text-bone-3 leading-relaxed">
              Structure only. Their footage, voice, faces and words are never reused; analysis frames stay on the
              machine that watched the video.
            </p>
          </Panel>
        </div>

        {/* the timeline */}
        <Panel className="p-4 pt-6 md:p-6 md:pt-7">
          <Timeline
            bp={bp}
            aligned={aligned}
            keyframes={keyframes}
            references={refs}
            review={review}
            t={t}
            onScrub={(x) => !scanning && setT(x)}
            scanning={scanning}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3 border-line border-t pt-4">
            <Button size="sm" onClick={scan} disabled={scanning} data-testid="rewatch">
              {scanning ? "Watching" : "Watch it again"}
            </Button>
            {remake ? (
              <span className="font-mono text-[11px] text-bone-3">
                remake: {remake.title} / {CHANNEL_LABELS[remake.channel]} /{" "}
                {remake.shots.reduce((s, x) => s + x.durationSec, 0)}s
              </span>
            ) : (
              <span className="font-mono text-[11px] text-bone-3">
                The remake appears here once production has run.
              </span>
            )}
            {remake && (
              <Link
                href={`/runs/${run?.id ?? ""}/studio`}
                className="ml-auto font-mono text-[11px] text-signal hover:underline"
              >
                Open in the studio
              </Link>
            )}
          </div>
        </Panel>

        {/* shot by shot */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px]">
          <ShotCard
            label={`their shot ${idx + 1} / ${shot.t0}s to ${shot.t1}s`}
            purpose={shot.purpose}
            rows={[
              ["shot", `${shot.shotType.replaceAll("_", " ")}, ${shot.camera}`],
              ["subject", shot.subject],
              ["action", shot.action],
              ["on screen", shot.onScreenText],
              ["voiceover", shot.voiceover],
              ["audio", shot.audioCue],
              ["transition", shot.transition],
            ]}
            frameUrl={nearestFrame(bp.frames, shot.t0, shot.t1)?.url}
            fallback={`${shot.subject}: ${shot.action}`}
          />
          <OurShotCard
            shot={ours}
            purpose={shot.purpose}
            review={review}
            keyframe={ours ? keyframes.get(ours.idx) : undefined}
          />
          <Hook bp={bp} onJump={() => setT(0.01)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            {bp.transcript && <Transcript text={bp.transcript} highlight={shot.voiceover} />}
            <Variants variants={variants} runId={run?.id} />
          </div>
          <SelfReview reviews={reviews ?? []} remake={remake} assets={assets ?? []} />
        </div>
      </div>
    </MotionConfig>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] text-bone-3 uppercase tracking-[0.08em]">{k}</dt>
      <dd className={cn("mt-1 text-[15px]", accent ? "text-signal" : "text-bone")}>{v}</dd>
    </div>
  );
}

function ShotCard({
  label,
  purpose,
  rows,
  frameUrl,
  fallback,
}: {
  label: string;
  purpose: Blueprint["shots"][number]["purpose"];
  rows: [string, string | undefined][];
  frameUrl?: string;
  fallback: string;
}) {
  return (
    <Panel tone="flat" className="flex min-w-0 gap-4 p-4" data-testid="their-shot">
      <ShotFrame
        url={frameUrl}
        fallback={fallback}
        purpose={purpose}
        className="aspect-[9/16] w-24 shrink-0 rounded-[8px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="mono-label truncate">{label}</p>
          <Purpose p={purpose} />
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[76px_1fr] gap-2">
                <dt className="font-mono text-[10.5px] text-bone-3">{k}</dt>
                <dd className="text-bone-2">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
    </Panel>
  );
}

function OurShotCard({
  shot,
  purpose,
  review,
  keyframe,
}: {
  shot?: Shot;
  purpose: Blueprint["shots"][number]["purpose"];
  review?: Review;
  keyframe?: string;
}) {
  if (!shot)
    return (
      <Panel tone="hairline" className="grid place-items-center p-6 text-center">
        <p className="font-serif text-[18px] text-bone-3 italic">No remade shot here yet.</p>
      </Panel>
    );
  const sc = shotScore(review, shot.idx);
  return (
    <Panel
      tone="flat"
      className="flex min-w-0 gap-4 p-4 shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(212_255_58/0.18)]"
      data-testid="our-shot"
    >
      <ShotFrame
        url={keyframe}
        fallback={shot.visualPrompt}
        purpose={purpose}
        className="aspect-[9/16] w-24 shrink-0 rounded-[8px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="mono-label truncate">
            our shot {shot.idx + 1} / {shot.durationSec}s
          </p>
          {sc && (
            <span
              className={cn(
                "font-mono text-[12px]",
                sc.score >= 80 ? "text-pass" : sc.score >= 65 ? "text-warn" : "text-fail",
              )}
            >
              review <NumberTicker value={sc.score} from={0} />
            </span>
          )}
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
          {(
            [
              ["visual", shot.visualPrompt],
              ["on screen", shot.onScreenText],
              ["voiceover", shot.voiceover],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[76px_1fr] gap-2">
                <dt className="font-mono text-[10.5px] text-bone-3">{k}</dt>
                <dd className="text-bone-2">{v}</dd>
              </div>
            ))}
        </dl>
        {sc && sc.issues.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 border-line border-t pt-2">
            {sc.issues.map((i) => (
              <li key={i} className="flex gap-2 text-[12px] text-warn">
                <span>!</span>
                {i}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function Hook({ bp, onJump }: { bp: Blueprint; onJump: () => void }) {
  const h = bp.hook;
  const frames = bp.frames.filter((f) => f.t <= Math.max(3, h.endSec)).slice(0, 6);
  return (
    <Panel className="flex flex-col gap-3 p-5" data-testid="hook">
      <div className="flex items-center justify-between">
        <p className="mono-label">the first {Math.max(3, Math.ceil(h.endSec))} seconds, magnified</p>
        <button onClick={onJump} className="font-mono text-[10.5px] text-signal hover:underline">
          jump to 0s
        </button>
      </div>
      {frames.length > 0 && (
        <div className="flex gap-1">
          {frames.map((f) => (
            <ShotFrame
              key={f.t}
              url={f.url}
              fallback=""
              purpose="hook"
              className="aspect-[9/16] flex-1 rounded-[6px]"
            />
          ))}
        </div>
      )}
      {h.spoken && <p className="font-serif text-[24px] leading-snug">&ldquo;{h.spoken}&rdquo;</p>}
      <dl className="flex flex-col gap-1.5 text-[12.5px]">
        <div className="grid grid-cols-[84px_1fr] gap-2">
          <dt className="font-mono text-[10.5px] text-bone-3">seen</dt>
          <dd className="text-bone-2">{h.visual}</dd>
        </div>
        {h.onScreenText && (
          <div className="grid grid-cols-[84px_1fr] gap-2">
            <dt className="font-mono text-[10.5px] text-bone-3">written</dt>
            <dd className="text-bone-2">{h.onScreenText}</dd>
          </div>
        )}
        <div className="grid grid-cols-[84px_1fr] gap-2">
          <dt className="font-mono text-[10.5px] text-bone-3">mechanism</dt>
          <dd className="text-signal">{h.mechanism}</dd>
        </div>
      </dl>
      <p className="border-line border-t pt-3 text-bone text-ui">
        <span className="mono-label mr-2">why it stops the scroll</span>
        {h.whyItStops}
      </p>
    </Panel>
  );
}

function Transcript({ text, highlight }: { text: string; highlight?: string }) {
  const i = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase().slice(0, 40)) : -1;
  return (
    <Panel tone="flat" className="p-5">
      <p className="mono-label">transcript of the winner</p>
      <p className="mt-3 font-serif text-[19px] text-bone-2 leading-relaxed">
        {i === -1 ? (
          text
        ) : (
          <>
            {text.slice(0, i)}
            <mark className="rounded-[3px] bg-signal-dim px-0.5 text-bone">{text.slice(i, i + highlight!.length)}</mark>
            {text.slice(i + highlight!.length)}
          </>
        )}
      </p>
    </Panel>
  );
}

function Variants({ variants, runId }: { variants: Concept[]; runId?: string }) {
  if (!variants.length) return null;
  return (
    <div>
      <p className="mono-label mb-3">the same winning idea, in every winning format</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {variants.map((v) => (
          <Link
            key={v.id}
            href={`/runs/${runId}/studio`}
            className="glass-flat group flex flex-col gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-panel-strong)]"
            data-testid="variant"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge tone="cyan">
                {v.format.replaceAll("_", " ")} / {v.aspect}
              </Badge>
              <ComplianceBadge status={v.compliance} />
            </div>
            <p className="font-medium text-bone text-ui">{v.title}</p>
            <p className="line-clamp-3 text-[12.5px] text-bone-2">{v.caption}</p>
            <span className="mt-auto font-mono text-[10.5px] text-bone-3">{CHANNEL_LABELS[v.channel]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SelfReview({
  reviews,
  remake,
  assets,
}: {
  reviews: Review[];
  remake?: Concept;
  assets: { id: string; url: string; kind: string }[];
}) {
  const rounds = [...reviews].sort((a, b) => a.round - b.round);
  const [sel, setSel] = useState<number>();
  const r = rounds.find((x) => x.round === sel) ?? rounds.at(-1);
  if (!remake || !r)
    return (
      <Panel tone="hairline" className="grid place-items-center p-6 text-center">
        <div>
          <p className="font-serif text-[20px] text-bone-2 italic">The agent reviews its own render here.</p>
          <p className="mt-2 font-mono text-[11px] text-bone-3">
            It scores every shot against this blueprint, then fixes the weakest.
          </p>
        </div>
      </Panel>
    );
  const video = assets.find((a) => a.id === r.assetId)?.url ?? assets.find((a) => a.kind === "video")?.url;
  return (
    <Panel className="flex flex-col gap-4 p-5" data-testid="self-review">
      <div className="flex items-center justify-between">
        <p className="mono-label">self-review / it watched its own video</p>
        <div className="flex gap-1">
          {rounds.map((x) => (
            <button
              key={x.round}
              onClick={() => setSel(x.round)}
              aria-pressed={x.round === r.round}
              className="rounded-chip px-2.5 py-1 font-mono text-[10.5px] text-bone-2 hairline aria-pressed:bg-bone aria-pressed:text-ink"
            >
              round {x.round}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_110px] gap-4">
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-[10px] text-bone-3 uppercase tracking-[0.08em]">overall</p>
              <p className="font-mono text-[34px] leading-none">
                <NumberTicker key={`o${r.round}`} value={r.overall} from={0} duration={1.1} />
              </p>
            </div>
            <div>
              <p className="text-[10px] text-bone-3 uppercase tracking-[0.08em]">blueprint match</p>
              <p className="font-mono text-[22px] leading-none text-bone-2">
                <NumberTicker key={`m${r.round}`} value={r.blueprintMatch} from={0} duration={1.1} />
              </p>
            </div>
          </div>
          <Badge tone={r.decision === "accept" ? "pass" : "warn"} className="mt-3">
            {r.decision === "accept"
              ? "Accepted"
              : `Regenerate shot ${(r.regeneratedShots ?? []).map((s) => s + 1).join(", ") || "weakest"}`}
          </Badge>
        </div>
        <PhoneFrame src={video} empty="No render on this machine" className="max-w-[110px] rounded-[20px]" />
      </div>
      <ul className="flex flex-col gap-1.5" aria-label={`Per-shot scores, round ${r.round}`}>
        {r.perShot.map((p) => {
          const tone = scoreTone(p.score);
          return (
            <li key={p.idx} className="grid grid-cols-[52px_1fr_32px] items-center gap-2" title={p.issues.join("; ")}>
              <span className="font-mono text-[10.5px] text-bone-3">shot {p.idx + 1}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line">
                <motion.span
                  key={`${r.round}-${p.idx}`}
                  className={cn(
                    "block h-full rounded-full",
                    tone === "pass" ? "bg-pass" : tone === "warn" ? "bg-warn" : "bg-fail",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${p.score}%` }}
                  transition={{ duration: 0.8, delay: p.idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums">{p.score}</span>
            </li>
          );
        })}
      </ul>
      <p className="border-line border-t pt-3 text-[12.5px] text-bone-2">{r.notes}</p>
    </Panel>
  );
}

function Purpose({ p }: { p: Blueprint["shots"][number]["purpose"] }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em]"
      style={{ color: PURPOSE_COLOR[p] }}
    >
      <span className="size-1.5 rounded-full" style={{ background: PURPOSE_COLOR[p] }} />
      {PURPOSE_LABEL[p]}
    </span>
  );
}

export function NoBlueprint({ runId }: { runId: string }) {
  return (
    <EmptyState
      title="No blueprint with this id"
      action={
        <Button asChild>
          <Link href={`/runs/${runId}`}>Back to the cockpit</Link>
        </Button>
      }
    >
      Blueprints appear after the reverse-engineering step has watched the winning videos.
    </EmptyState>
  );
}
