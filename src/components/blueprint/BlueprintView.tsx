"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRunCtx } from "@/components/run/RunContext";
import { Badge, ComplianceBadge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { type Blueprint, CHANNEL_LABELS, type Concept, type Review, type Shot } from "@/contracts";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { formatCount, SOURCE_LABELS } from "@/lib/client/format";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";
import { useBlueprint, useBrand, useConceptAssets, useConceptReviews, useConcepts } from "@/lib/client/queries";
import { alignRemake, keyframeUrls, latestReview, scoreTone, shotAt, shotScore } from "./align";
import { ShotFrame, Timeline, tc } from "./Timeline";

const TONE_TEXT = { pass: "text-pass", warn: "text-warn", fail: "text-fail" } as const;

/** Our render's time for a moment of the original: same shot, same fraction of it (shots map 1:1 via shotMap). */
export function remakeTime(bp: Pick<Blueprint, "shots">, aligned: (Shot | undefined)[], all: Shot[], t: number) {
  const i = shotAt(bp.shots, t);
  const s = bp.shots[i];
  const ours = aligned[i];
  if (!s || !ours) return t;
  const start = all.reduce((acc, x) => (x.idx < ours.idx ? acc + x.durationSec : acc), 0);
  return start + Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0 || 1))) * ours.durationSec;
}

export function BlueprintView({ blueprintId }: { blueprintId: string }) {
  const { runId, run } = useRunCtx();
  const { data: bp, isLoading, error, refetch } = useBlueprint(blueprintId);
  const { data: concepts } = useConcepts(runId);
  const { data: brand } = useBrand(run?.brandId);
  const remake = concepts?.find((c) => c.blueprintId === blueprintId && !c.variantOf);
  const variants = concepts?.filter((c) => remake && c.variantOf === remake.id) ?? [];
  const { data: assets } = useConceptAssets(remake?.id);
  const { data: reviews } = useConceptReviews(remake?.id);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  const aligned = useMemo(() => (bp ? alignRemake(bp, remake) : []), [bp, remake]);
  const keyframes = useMemo(() => keyframeUrls(assets, remake?.shots), [assets, remake]);
  const review = latestReview(reviews);
  const video =
    assets?.find((a) => a.id === review?.assetId) ??
    assets?.find((a) => a.id === remake?.videoAssetId) ??
    assets?.filter((a) => a.kind === "video").at(-1);

  // the playhead is the only continuous motion; one pass plays on arrival (never under reduced motion)
  const raf = useRef(0);
  useEffect(() => {
    if (!playing || !bp) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let done = false;
      setT((x) => {
        const n = x + dt;
        if (n >= bp.durationSec - 0.001) done = true;
        return Math.min(n, bp.durationSec - 0.001);
      });
      if (done) setPlaying(false);
      else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, bp]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: start one pass when the blueprint arrives
  useEffect(() => {
    if (bp && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(0);
      setPlaying(true);
    }
  }, [bp?.id]);

  if (error)
    return (error as { status?: number }).status === 404 || /not found/i.test(String((error as Error).message)) ? (
      <NoBlueprint runId={runId} />
    ) : (
      <ErrorState title="Could not load the blueprint" error={error} onRetry={() => refetch()} />
    );
  if (isLoading || !bp)
    return (
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[400px] rounded-panel lg:col-span-8" />
        <Skeleton className="h-[400px] rounded-panel lg:col-span-4" />
      </div>
    );

  const ev = bp.evidence;
  const idx = Math.max(0, shotAt(bp.shots, t));
  const shot = bp.shots[idx];
  const ours = aligned[idx];
  const refs = remake ? referenceImages(brand) : [];
  const scrub = (x: number) => {
    setPlaying(false);
    setT(x);
  };
  const frame = [...bp.frames].reverse().find((f) => f.t <= t) ?? bp.frames[0];
  const ourStill = ours ? (keyframes.get(ours.idx) ?? (refs.length ? refs[idx % refs.length] : undefined)) : undefined;
  const ourT = remakeTime(bp, aligned, remake?.shots ?? [], t);

  return (
    <div className="flex flex-col gap-5" data-testid="blueprint-view">
      <div className="grid gap-5 lg:grid-cols-12">
        <section
          aria-label="Program monitor"
          className="flex flex-col overflow-hidden rounded-panel bg-viewer lg:col-span-8"
        >
          <div className="grid flex-1 grid-cols-2 gap-px bg-[#222]">
            <Viewer label="Original" time={t} recording={playing}>
              <ShotFrame
                url={frame?.url}
                fallback={`${shot.subject}: ${shot.action}`}
                purpose={shot.purpose}
                className="h-full w-full"
              />
              {shot.onScreenText && <Caption text={shot.onScreenText} />}
            </Viewer>
            <Viewer label="Our remake" time={ourT}>
              {video ? (
                <SyncedVideo src={video.url} time={ourT} playing={playing} />
              ) : ours ? (
                <>
                  <ShotFrame
                    url={ourStill}
                    reference={!keyframes.get(ours.idx) && !!ourStill}
                    fallback={ours.visualPrompt}
                    purpose={shot.purpose}
                    className="h-full w-full"
                  />
                  {ours.onScreenText && <Caption text={ours.onScreenText} />}
                </>
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-[13px] text-white/60">
                  Not produced yet. A run on this research makes it.
                </div>
              )}
            </Viewer>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-[#222] border-t px-4 py-3 text-white">
            <button
              onClick={() => scrub(bp.shots[Math.max(0, idx - 1)].t0 + 0.001)}
              aria-label="Previous shot"
              className="grid size-8 place-items-center rounded-[4px] text-white/80 hover:bg-white/10"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <path d="M4 3v10M13 3 6 8l7 5V3Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              data-testid="rewatch"
              onClick={() => {
                if (!playing && t >= bp.durationSec - 0.05) setT(0);
                setPlaying((p) => !p);
              }}
              className="flex h-8 items-center gap-2 rounded-[4px] bg-signal px-3 font-medium text-[13px] text-white hover:bg-[#cf2b26]"
            >
              {playing ? (
                <>
                  <span className="flex gap-[3px]" aria-hidden>
                    <span className="h-3 w-[3px] bg-white" />
                    <span className="h-3 w-[3px] bg-white" />
                  </span>
                  Pause
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <path d="M4 2.5v11l9-5.5-9-5.5Z" fill="currentColor" />
                  </svg>
                  Play both
                </>
              )}
            </button>
            <button
              onClick={() => scrub(bp.shots[Math.min(bp.shots.length - 1, idx + 1)].t0 + 0.001)}
              aria-label="Next shot"
              className="grid size-8 place-items-center rounded-[4px] text-white/80 hover:bg-white/10"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <path d="M12 3v10M3 3l7 5-7 5V3Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <span className="font-mono text-[12px] text-white/90 tabular-nums">
              {tc(t)} <span className="text-white/40">/ {tc(bp.durationSec)}</span>
            </span>
            <span className="ml-auto flex items-center gap-2 text-[12px] text-white/70">
              <span className="size-2 rounded-[1px]" style={{ background: PURPOSE_COLOR[shot.purpose] }} />
              Shot {idx + 1} of {bp.shots.length}: {PURPOSE_LABEL[shot.purpose]}
            </span>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          <div>
            <p className="mono-label">
              Reverse-engineer / {ev ? `${SOURCE_LABELS[ev.source]} ${ev.kind}` : "winning video"}
              {ev?.author ? `, ${ev.author}` : ""}
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.7rem,2.6vw,2.3rem)] leading-[1.05]">
              We took apart the ad that is winning. Then we rebuilt it for {brand?.name ?? "the brand"}.
            </h1>
          </div>
          <dl className="grid grid-cols-3 border-line border-y py-2">
            {ev?.metrics.views != null && <Stat k="Views" v={formatCount(ev.metrics.views)} />}
            {ev?.metrics.outlierScore != null && (
              <Stat k="vs account median" v={`${ev.metrics.outlierScore.toFixed(1)}x`} />
            )}
            {ev?.metrics.daysRunning != null && <Stat k="Running" v={`${ev.metrics.daysRunning} days`} />}
            <Stat k="Length" v={`${bp.durationSec}s`} />
            <Stat k="Cuts" v={`${bp.pacing.cutsPer10s} per 10s`} />
            <Stat k="Structure" v={bp.structure.replaceAll("_", " ")} />
          </dl>
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-[14px]">Why it wins</h2>
              {bp.demo && <DemoBadge />}
            </div>
            <p className="mt-1.5 text-[14px] text-bone-2 leading-relaxed">{bp.whyItWins}</p>
          </div>
          <p className="text-[12px] text-bone-3">
            Structure only: their footage, voice, faces and words are never reused. Analysis frames stay on the machine
            that watched the video.
          </p>
        </aside>
      </div>

      <Panel tone="flat" className="p-4 md:p-5">
        <Timeline
          bp={bp}
          aligned={aligned}
          keyframes={keyframes}
          references={refs}
          review={review}
          t={t}
          onScrub={scrub}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <ShotCard
          title={`Their shot ${idx + 1}`}
          sub={`${shot.t0}s to ${shot.t1}s`}
          purpose={shot.purpose}
          testId="their-shot"
          rows={[
            ["Shot", `${shot.shotType.replaceAll("_", " ")}, ${shot.camera}`],
            ["Subject", shot.subject],
            ["Action", shot.action],
            ["On screen", shot.onScreenText],
            ["Voiceover", shot.voiceover],
            ["Audio", shot.audioCue],
            ["Transition", shot.transition],
          ]}
        />
        <OurShot shot={ours} purpose={shot.purpose} review={review} />
        <Hook bp={bp} onJump={() => scrub(0.01)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          {bp.transcript && <Transcript text={bp.transcript} highlight={shot.voiceover} />}
          <Variants variants={variants} runId={run?.id} />
          {remake && (
            <p className="text-[13px] text-bone-2">
              Remake: {remake.title}, {CHANNEL_LABELS[remake.channel]},{" "}
              {remake.shots.reduce((s, x) => s + x.durationSec, 0)}s.{" "}
              <Link
                href={`/runs/${run?.id ?? ""}/studio`}
                className="text-bone underline decoration-bone-4 underline-offset-4"
              >
                Open it in the studio
              </Link>
            </p>
          )}
        </div>
        <SelfReview reviews={reviews ?? []} remake={remake} />
      </div>
    </div>
  );
}

function Viewer({
  label,
  time,
  recording,
  children,
}: {
  label: string;
  time: number;
  recording?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-viewer">
      <div className="relative mx-auto aspect-[9/16] h-[min(52vh,400px)] max-w-full">{children}</div>
      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-[3px] bg-black/70 px-1.5 py-1 font-semibold text-[10px] text-white uppercase tracking-[0.06em]">
        {recording && <span className="size-1.5 rounded-full bg-signal" aria-hidden />}
        {label}
      </span>
      <span className="absolute bottom-3 left-3 rounded-[3px] bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white tabular-nums">
        {tc(time)}
      </span>
    </div>
  );
}

function Caption({ text }: { text: string }) {
  return (
    <span className="absolute inset-x-3 bottom-12 rounded-[3px] bg-white px-2 py-1.5 text-center font-semibold text-[#111] text-[13px] leading-tight">
      {text}
    </span>
  );
}

/** Our render follows the playhead: seeks while paused, plays along and corrects drift while playing. */
function SyncedVideo({ src, time, playing }: { src: string; time: number; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !Number.isFinite(time)) return;
    if (!playing || Math.abs(v.currentTime - time) > 0.35) v.currentTime = time;
  }, [time, playing]);
  if (broken)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[13px] text-white/60">
        The render is not on this machine.
      </div>
    );
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="py-1.5">
      <dt className="text-[11px] text-bone-3">{k}</dt>
      <dd className="mt-0.5 truncate font-mono text-[13px] text-bone">{v}</dd>
    </div>
  );
}

function Head({
  title,
  sub,
  purpose,
  aside,
}: {
  title: string;
  sub?: string;
  purpose: Blueprint["shots"][number]["purpose"];
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-line border-b pb-2">
      <div className="flex items-baseline gap-2">
        <h3 className="font-semibold text-[14px]">{title}</h3>
        {sub && <span className="font-mono text-[11px] text-bone-3">{sub}</span>}
      </div>
      {aside ?? (
        <span
          className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-[0.04em]"
          style={{ color: PURPOSE_COLOR[purpose] }}
        >
          <span className="size-2 rounded-[1px]" style={{ background: PURPOSE_COLOR[purpose] }} />
          {PURPOSE_LABEL[purpose]}
        </span>
      )}
    </div>
  );
}

function ShotCard({
  title,
  sub,
  purpose,
  rows,
  testId,
}: {
  title: string;
  sub: string;
  purpose: Blueprint["shots"][number]["purpose"];
  rows: [string, string | undefined][];
  testId: string;
}) {
  return (
    <Panel tone="flat" className="p-4" data-testid={testId}>
      <Head title={title} sub={sub} purpose={purpose} />
      <Rows rows={rows} />
    </Panel>
  );
}

function Rows({ rows }: { rows: readonly (readonly [string, string | undefined])[] }) {
  return (
    <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="grid grid-cols-[84px_1fr] gap-2">
            <dt className="text-bone-3">{k}</dt>
            <dd className="text-bone">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function OurShot({
  shot,
  purpose,
  review,
}: {
  shot?: Shot;
  purpose: Blueprint["shots"][number]["purpose"];
  review?: Review;
}) {
  if (!shot)
    return (
      <Panel tone="hairline" className="grid place-items-center p-6 text-center">
        <p className="text-[13px] text-bone-3">No remade shot here yet.</p>
      </Panel>
    );
  const sc = shotScore(review, shot.idx);
  return (
    <Panel tone="flat" className="p-4" data-testid="our-shot">
      <Head
        title={`Our shot ${shot.idx + 1}`}
        sub={`${shot.durationSec}s`}
        purpose={purpose}
        aside={
          sc ? (
            <span className={cn("font-mono text-[12px]", TONE_TEXT[scoreTone(sc.score)])}>review {sc.score}</span>
          ) : undefined
        }
      />
      <Rows
        rows={[
          ["Visual", shot.visualPrompt],
          ["On screen", shot.onScreenText],
          ["Voiceover", shot.voiceover],
        ]}
      />
      {sc && sc.issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-line border-t pt-2">
          {sc.issues.map((i) => (
            <li key={i} className="text-[12.5px] text-warn">
              {i}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Hook({ bp, onJump }: { bp: Blueprint; onJump: () => void }) {
  const h = bp.hook;
  return (
    <Panel tone="flat" className="flex flex-col gap-3 p-4" data-testid="hook">
      <Head
        title={`The first ${Math.max(3, Math.ceil(h.endSec))} seconds`}
        purpose="hook"
        aside={
          <button onClick={onJump} className="text-[12px] text-bone underline decoration-bone-4 underline-offset-4">
            Jump to 0s
          </button>
        }
      />
      {h.spoken && (
        <p className="font-semibold text-[18px] leading-snug tracking-[-0.01em]">&ldquo;{h.spoken}&rdquo;</p>
      )}
      <Rows
        rows={[
          ["Seen", h.visual],
          ["Written", h.onScreenText],
          ["Mechanism", h.mechanism],
        ]}
      />
      <p className="border-line border-t pt-2 text-[13px] text-bone-2">
        <span className="font-semibold text-bone">Why it stops the scroll. </span>
        {h.whyItStops}
      </p>
    </Panel>
  );
}

function Transcript({ text, highlight }: { text: string; highlight?: string }) {
  const i = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase().slice(0, 40)) : -1;
  return (
    <Panel tone="flat" className="p-4">
      <h3 className="font-semibold text-[14px]">Transcript of the winner</h3>
      <p className="mt-2 text-[15px] text-bone-2 leading-relaxed">
        {i === -1 ? (
          text
        ) : (
          <>
            {text.slice(0, i)}
            <mark className="bg-[#f6e3b8] px-0.5 text-bone">{text.slice(i, i + highlight!.length)}</mark>
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
      <h3 className="mb-2 font-semibold text-[14px]">The same idea in the other winning formats</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {variants.map((v) => (
          <Link
            key={v.id}
            href={`/runs/${runId}/studio`}
            className="glass-flat flex flex-col gap-2 p-4 hover:shadow-[inset_0_0_0_1px_var(--color-bone-4)]"
            data-testid="variant"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge>
                {v.format.replaceAll("_", " ")} / {v.aspect}
              </Badge>
              <ComplianceBadge status={v.compliance} />
            </div>
            <p className="font-medium text-[14px]">{v.title}</p>
            <p className="line-clamp-3 text-[13px] text-bone-2">{v.caption}</p>
            <span className="mt-auto text-[12px] text-bone-3">{CHANNEL_LABELS[v.channel]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SelfReview({ reviews, remake }: { reviews: Review[]; remake?: Concept }) {
  const rounds = [...reviews].sort((a, b) => a.round - b.round);
  const [sel, setSel] = useState<number>();
  const r = rounds.find((x) => x.round === sel) ?? rounds.at(-1);
  if (!remake || !r)
    return (
      <Panel tone="hairline" className="grid place-items-center p-6 text-center">
        <p className="text-[13px] text-bone-2">
          After rendering, the agent watches its own video, scores every shot against this blueprint, then fixes the
          weakest.
        </p>
      </Panel>
    );
  return (
    <Panel tone="flat" className="flex flex-col gap-3 p-4" data-testid="self-review">
      <div className="flex items-center justify-between border-line border-b pb-2">
        <h3 className="font-semibold text-[14px]">Self-review: it watched its own video</h3>
        <div className="flex gap-1">
          {rounds.map((x) => (
            <button
              key={x.round}
              onClick={() => setSel(x.round)}
              aria-pressed={x.round === r.round}
              className="rounded-[4px] px-2 py-1 text-[12px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] aria-pressed:bg-bone aria-pressed:text-ink"
            >
              round {x.round}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-baseline gap-6">
        <div>
          <p className="text-[11px] text-bone-3">Overall</p>
          <p className="font-mono text-[30px] leading-none">{r.overall}</p>
        </div>
        <div>
          <p className="text-[11px] text-bone-3">Blueprint match</p>
          <p className="font-mono text-[20px] text-bone-2 leading-none">{r.blueprintMatch}</p>
        </div>
        <Badge tone={r.decision === "accept" ? "pass" : "warn"} className="ml-auto">
          {r.decision === "accept"
            ? "Accepted"
            : `Regenerate shot ${(r.regeneratedShots ?? []).map((s) => s + 1).join(", ") || "weakest"}`}
        </Badge>
      </div>
      <ul className="flex flex-col gap-1.5" aria-label={`Per-shot scores, round ${r.round}`}>
        {r.perShot.map((p) => {
          const tone = scoreTone(p.score);
          return (
            <li key={p.idx} className="grid grid-cols-[52px_1fr_28px] items-center gap-2" title={p.issues.join("; ")}>
              <span className="text-[12px] text-bone-3">Shot {p.idx + 1}</span>
              <span className="h-2 bg-raised-2">
                <span
                  className={cn("block h-full", tone === "pass" ? "bg-pass" : tone === "warn" ? "bg-warn" : "bg-fail")}
                  style={{ width: `${p.score}%` }}
                />
              </span>
              <span className="text-right font-mono text-[12px] tabular-nums">{p.score}</span>
            </li>
          );
        })}
      </ul>
      <p className="border-line border-t pt-2 text-[13px] text-bone-2">{r.notes}</p>
    </Panel>
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
