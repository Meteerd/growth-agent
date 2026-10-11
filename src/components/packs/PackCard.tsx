"use client";

import { useEffect, useRef, useState } from "react";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { toast } from "@/components/ui/Toast";
import { type Asset, CHANNEL_LABELS, type Concept, type MetricSnapshot, type PublishPack } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { timeAgo } from "@/lib/client/format";
import { MOCK_VIDEO } from "@/lib/client/mock/client";
import { useBrand, useConceptAssets } from "@/lib/client/queries";
import { LandingAction } from "./LandingAction";
import { METRIC_KEYS } from "./metrics";
import { CheckGlyph, MarkPostedDialog, MetricsDialog } from "./PackForms";

const ASPECT_RATIO: Record<Concept["aspect"], string> = {
  "9:16": "9 / 16",
  "4:5": "4 / 5",
  "1:1": "1 / 1",
  "16:9": "16 / 9",
};
const formatLabel = (f?: Concept["format"]) => f?.replace("broll", "b-roll").replaceAll("_", " ");
const postTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

export function PackCard({
  pack,
  n,
  concept,
  runId,
  demo,
  snapshot,
}: {
  pack: PublishPack;
  n: number;
  concept?: Concept;
  runId: string;
  demo: boolean;
  snapshot?: MetricSnapshot;
}) {
  // shortcut: no per-pack snapshots query; the latest entry lives here, falling back to the brand results query.
  const [entered, setEntered] = useState<MetricSnapshot>();
  const latest = entered ?? snapshot;
  const posted = pack.status === "posted";
  const tags = pack.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`));
  const platform = CHANNEL_LABELS[pack.platform];
  const download = getClient().packDownloadUrl(pack.id);
  const titleId = `${pack.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      data-testid={`pack-card-${pack.id}`}
      data-status={pack.status}
      className={cn(
        "grid overflow-hidden rounded-panel border bg-raised transition-colors duration-200",
        "md:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_304px]",
        posted ? "border-[rgb(31_122_77/0.4)]" : "border-line",
      )}
    >
      <Cover pack={pack} concept={concept} n={n} demo={demo} />

      <div className="min-w-0 p-5 md:p-6">
        <header>
          <div className="flex items-center justify-between gap-3">
            <p className="mono-label truncate">
              pack {String(n).padStart(2, "0")} / {platform}
              {concept && ` / ${formatLabel(concept.format)}`}
            </p>
            <StatusPill posted={posted} />
          </div>
          <h3 id={titleId} className="mt-3 font-display text-[24px] text-bone leading-[1.1] md:text-[28px]">
            {concept?.title ?? `${platform} post`}
          </h3>
          {concept?.hook && (
            <p className="mt-2.5 text-bone-2 text-ui">
              <span className="font-medium text-bone">Hook: </span>
              {concept.hook}
            </p>
          )}
        </header>

        <Block
          label="Caption"
          aside={
            <CopyButton
              text={[pack.caption, tags.join(" ")].filter(Boolean).join("\n\n")}
              label="Copy"
              done={{
                title: "Caption copied",
                body: tags.length
                  ? `With ${tags.length} hashtags. Paste it into ${platform}.`
                  : `Paste it into ${platform}.`,
              }}
              testId="pack-copy-caption"
            />
          }
        >
          <p className="whitespace-pre-line text-bone text-body" data-testid="pack-caption">
            {pack.caption}
          </p>
          {tags.length > 0 && (
            <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label="Hashtags">
              {tags.map((t) => (
                <li key={t} className="rounded-[4px] border border-line px-2 py-0.5 text-[12px] text-bone-2">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Block>

        {pack.firstComment && (
          <Block
            label="First comment"
            aside={
              <CopyButton
                text={pack.firstComment}
                label="Copy"
                done={{ title: "First comment copied", body: "Post it as the first reply, right after posting." }}
              />
            }
          >
            <p className="flex gap-2.5 text-bone-2 text-ui">
              <ReplyGlyph />
              {pack.firstComment}
            </p>
          </Block>
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col gap-6 border-line border-t p-5 md:col-start-2 md:p-6",
          "xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:border-l",
        )}
      >
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-[12.5px]">
          <dt className="text-bone-2">Post time</dt>
          <dd className="text-right font-mono text-[12px] text-bone tabular-nums">
            {pack.postAt ? (
              <time dateTime={pack.postAt}>{postTime.format(new Date(pack.postAt))}</time>
            ) : (
              <span className="font-sans text-bone-2">your call</span>
            )}
          </dd>
          <dt className="text-bone-2">Pack</dt>
          <dd className="truncate text-right font-mono text-[12px] text-bone-3">{pack.id}</dd>
        </dl>

        <Checklist items={pack.checklist} />

        {posted && <PostedBlock pack={pack} latest={latest} />}

        <div className="mt-auto flex flex-wrap gap-2">
          {posted ? (
            <MetricsDialog pack={pack} runId={runId} last={latest} onSaved={setEntered} />
          ) : (
            <MarkPostedDialog pack={pack} runId={runId} />
          )}
          <Button asChild className="flex-1">
            <a
              href={download}
              download={download.startsWith("data:") ? `${pack.id}-mock.txt` : `${pack.id}.zip`}
              data-testid="pack-download"
            >
              <DownloadGlyph />
              Download pack
            </a>
          </Button>
        </div>
        <LandingAction pack={pack} runId={runId} />
      </div>
    </article>
  );
}

const byShot = (a: Asset, b: Asset) => (a.shotIdx ?? 0) - (b.shotIdx ?? 0);

/**
 * Real media only: the rendered video in a black viewer, else a rendered still or keyframe, else the brand's own
 * art labelled as such. The mock placeholder video is never shown as if it were a render.
 */
function Cover({ pack, concept, n, demo }: { pack: PublishPack; concept?: Concept; n: number; demo: boolean }) {
  const { data: assets = [] } = useConceptAssets(pack.conceptId);
  const { data: brand } = useBrand(pack.brandId);
  const [bad, setBad] = useState<string[]>([]);
  const drop = (u: string) => () => setBad((b) => [...b, u]);
  const ok = (a?: Asset) => (a && !bad.includes(a.url) ? a : undefined);

  const videos = assets.filter((a) => a.kind === "video" && a.url !== MOCK_VIDEO);
  const video = ok(videos.find((a) => a.id === pack.videoAssetId) ?? videos.at(-1));
  const keyframe = ok(assets.filter((a) => a.kind === "keyframe").sort(byShot)[0]);
  const still =
    ok(assets.find((a) => a.kind === "cover")) ??
    ok(assets.find((a) => a.kind === "image" && pack.imageAssetIds.includes(a.id))) ??
    keyframe;
  const art = referenceImages(brand).filter((u) => !bad.includes(u));
  const artUrl = art.length ? art[(n - 1) % art.length] : undefined;
  const text = concept?.format === "text_post";
  const aspect = concept?.aspect ?? "9:16";
  const secs = video?.durationSec;

  const caption = text
    ? "Text post, no image"
    : video
      ? "Render"
      : still
        ? still.kind === "keyframe"
          ? `Keyframe, shot ${(still.shotIdx ?? 0) + 1}`
          : "Rendered image"
        : artUrl
          ? "Brand art, no render yet"
          : "No render yet";

  return (
    <div className="flex min-w-0 flex-col border-line border-b md:row-span-2 md:border-r md:border-b-0 xl:row-span-1">
      <div className={cn("grid flex-1 place-items-center p-6", text ? "bg-raised-2" : "bg-viewer")}>
        <div
          className={cn("relative w-full overflow-hidden rounded-[3px]", text ? "bg-raised" : "bg-raised-2")}
          style={{ aspectRatio: ASPECT_RATIO[aspect], maxWidth: aspect === "16:9" ? 248 : 224 }}
        >
          {text ? (
            <TextTile
              platform={CHANNEL_LABELS[pack.platform]}
              title={concept?.title}
              body={concept?.body ?? pack.caption}
            />
          ) : video ? (
            <Viewer src={video.url} poster={keyframe?.url} onError={drop(video.url)} />
          ) : still || artUrl ? (
            // biome-ignore lint/performance/noImgElement: engine assets and brand art from the asset route
            <img
              src={still?.url ?? artUrl}
              alt=""
              loading="lazy"
              onError={drop((still?.url ?? artUrl)!)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <p className="absolute inset-0 grid place-items-center p-4 text-center text-[12px] text-bone-3">
              No render yet
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-line border-t px-4 py-2.5 text-[12px]">
        <span className="truncate text-bone-2">
          {caption}
          {video && (
            <span className="font-mono text-bone-3 tabular-nums">
              {" "}
              {aspect}
              {secs ? `, ${Math.round(secs)}s` : ""}
            </span>
          )}
        </span>
        {demo && <DemoBadge label="Demo" />}
      </div>
    </div>
  );
}

/** Program-monitor player: muted loop, click to pause, record-red playhead along the bottom. */
function Viewer({ src, poster, onError }: { src: string; poster?: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(onError);
    else v.pause();
  };
  return (
    <>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
        onError={onError}
        className="absolute inset-0 h-full w-full bg-viewer object-cover"
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause the render" : "Play the render"}
        className="absolute inset-0 grid place-items-center"
      >
        {!playing && (
          <span className="grid size-11 place-items-center rounded-full bg-raised text-bone">
            <svg viewBox="0 0 16 16" className="ml-0.5 size-4" aria-hidden>
              <path d="M4 2.5v11l9-5.5-9-5.5Z" fill="currentColor" />
            </svg>
          </span>
        )}
      </button>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-[rgb(255_255_255/0.2)]">
        <div className="h-full bg-signal" style={{ width: `${t * 100}%` }} />
      </div>
    </>
  );
}

/** A text post has no media: show the post itself, set like the platform will show it. */
function TextTile({ platform, title, body }: { platform: string; title?: string; body: string }) {
  return (
    <div className="absolute inset-0 flex flex-col gap-2 p-3.5">
      <p className="text-[11px] text-bone-3">{platform}</p>
      {title && <p className="line-clamp-3 font-semibold text-[14px] text-bone leading-snug">{title}</p>}
      <p className="line-clamp-4 text-[11.5px] text-bone-2 leading-snug">{body}</p>
    </div>
  );
}

/** Ready to Posted: colours cross over and the label slides (both labels share one grid cell, so no width jump). */
function StatusPill({ posted }: { posted: boolean }) {
  const label =
    "col-start-1 row-start-1 flex items-center gap-1.5 transition-[opacity,transform] duration-200 ease-out";
  return (
    <span
      data-testid="pack-status"
      data-state={posted ? "posted" : "ready"}
      className={cn(
        "inline-grid h-6 shrink-0 items-center overflow-hidden rounded-chip border px-2.5 font-medium text-[12px]",
        "transition-colors duration-200 ease-out",
        posted ? "border-[rgb(31_122_77/0.35)] bg-[rgb(31_122_77/0.08)] text-pass" : "border-line-strong text-bone",
      )}
    >
      <span aria-hidden={posted} className={cn(label, posted && "-translate-y-full opacity-0")}>
        <span className="size-1.5 rounded-full bg-bone" />
        Ready
      </span>
      <span aria-hidden={!posted} className={cn(label, !posted && "translate-y-full opacity-0")}>
        <CheckGlyph className="size-3" />
        Posted
      </span>
    </span>
  );
}

function Block({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-line border-t pt-4">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h4 className="mono-label">{label}</h4>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function CopyButton({
  text,
  label,
  done,
  testId,
}: {
  text: string;
  label: string;
  done: { title: string; body: string };
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast({ title: "Could not copy", body: "Select the text and copy it by hand.", tone: "fail" });
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
    toast({ ...done, tone: "pass" });
  };
  return (
    <Button
      size="sm"
      variant="quiet"
      onClick={copy}
      data-testid={testId}
      className={cn("h-7 min-w-[86px] px-2.5 text-[12px]", copied && "text-pass hover:text-pass")}
    >
      {copied ? <CheckGlyph className="size-3" /> : <CopyGlyph />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const count = done.filter(Boolean).length;
  return (
    <fieldset>
      <legend className="sr-only">
        Checklist, {count} of {items.length} done
      </legend>
      <div aria-hidden className="flex items-baseline justify-between">
        <span className="mono-label">Checklist</span>
        <span className="font-mono text-[11px] text-bone-3 tabular-nums">
          {count}/{items.length}
        </span>
      </div>
      <div aria-hidden className="mt-2 h-px bg-line">
        <div
          className="h-px bg-bone transition-[width] duration-200 ease-out"
          style={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-col gap-0.5">
        {items.map((it, i) => {
          const on = !!done[i];
          return (
            <li key={it}>
              <label className="-mx-2 flex cursor-pointer items-start gap-3 rounded-card px-2 py-1.5 transition-colors duration-150 hover:bg-raised-2/60">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={(e) => setDone((d) => d.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors duration-150",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-bone peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid",
                    on ? "border-bone bg-bone" : "border-bone-4 bg-raised",
                  )}
                >
                  <svg viewBox="0 0 12 12" className={cn("size-3 text-ink", !on && "opacity-0")} fill="none">
                    <path
                      d="M2.6 6.3 5 8.6l4.4-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  className={cn(
                    "text-ui transition-colors duration-150",
                    on ? "text-bone-3 line-through decoration-bone-4" : "text-bone-2",
                  )}
                >
                  {it}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function PostedBlock({ pack, latest }: { pack: PublishPack; latest?: MetricSnapshot }) {
  const url = pack.postedUrl ?? "";
  const safe = /^https?:\/\//i.test(url); // never render a javascript: or other scheme from stored data as a link
  const short = url.replace(/^https?:\/\/(www\.)?/i, "");
  const present = latest ? METRIC_KEYS.filter((k) => latest[k] != null) : [];
  return (
    <div data-testid="pack-posted" className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label">Live post</span>
          {pack.postedAt && <span className="text-[12px] text-bone-3">posted {timeAgo(pack.postedAt)}</span>}
        </div>
        {safe ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-bone underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-bone"
          >
            <span className="truncate">{short}</span>
            <ArrowGlyph />
          </a>
        ) : (
          <p className="mt-1.5 truncate font-mono text-[12px] text-bone-2">{url || "No link saved"}</p>
        )}
      </div>
      {latest && present.length ? (
        <div data-testid="pack-metrics">
          <div className="flex items-baseline justify-between gap-3">
            <span className="mono-label">Latest numbers</span>
            <span className="text-[12px] text-bone-3">
              {latest.source === "manual" ? "entered" : "synced"} {timeAgo(latest.capturedAt)}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-line bg-line">
            {present.map((k) => (
              <div key={k} className="flex flex-col-reverse bg-raised px-3 py-2.5">
                <dt className="mt-1 text-[11.5px] text-bone-3">{k}</dt>
                <dd className="text-bone text-body">
                  <NumberTicker value={latest[k] ?? 0} from={0} />
                </dd>
              </div>
            ))}
            {Array.from({ length: (3 - (present.length % 3)) % 3 }, (_, i) => (
              <div key={`pad-${i}`} aria-hidden className="bg-raised" />
            ))}
          </dl>
        </div>
      ) : (
        <p className="rounded-card border border-line px-3 py-2.5 text-[12.5px] text-bone-2">
          Waiting for first metrics. Enter them from {CHANNEL_LABELS[pack.platform]} insights once the post has numbers.
        </p>
      )}
    </div>
  );
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReplyGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 text-bone-3" fill="none" aria-hidden>
      <path
        d="M3 3v4.5A2.5 2.5 0 0 0 5.5 10H13m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="none" aria-hidden>
      <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
