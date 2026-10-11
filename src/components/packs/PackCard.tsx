"use client";

import { useEffect, useRef, useState } from "react";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { toast } from "@/components/ui/Toast";
import { CHANNEL_LABELS, type Concept, type MetricSnapshot, type PublishPack } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { timeAgo } from "@/lib/client/format";
import { useConceptAssets } from "@/lib/client/queries";
import { METRIC_KEYS } from "./metrics";
import { CheckGlyph, MarkPostedDialog, MetricsDialog } from "./PackForms";

const STILL_FORMATS = new Set<Concept["format"]>(["static", "carousel", "text_post"]);
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
        "glass-flat relative grid overflow-hidden transition-shadow duration-500",
        "md:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_316px]",
        posted && "shadow-[var(--shadow-panel),inset_0_1px_0_0_rgb(124_255_178/0.22)]",
      )}
    >
      <Cover pack={pack} concept={concept} demo={demo} />

      <div className="min-w-0 p-5 md:p-6">
        <header>
          <div className="flex items-center justify-between gap-3">
            <p className="mono-label truncate">
              pack {String(n).padStart(2, "0")} / {platform}
              {concept && ` / ${formatLabel(concept.format)}`}
            </p>
            <StatusPill posted={posted} />
          </div>
          <h3 id={titleId} className="mt-3 font-serif text-[26px] text-bone leading-[1.08] md:text-[30px]">
            {concept?.title ?? `${platform} post`}
          </h3>
          {concept?.hook && (
            <p className="mt-2.5 flex gap-2.5 text-bone-2 text-ui">
              <span className="mono-label mt-px shrink-0 text-bone-3">hook</span>
              <span className="italic">{concept.hook}</span>
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
                <li
                  key={t}
                  className="rounded-chip bg-glass px-2.5 py-1 font-mono text-[11px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line)]"
                >
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
          "flex min-w-0 flex-col gap-6 border-line border-t bg-[rgb(255_255_255/0.012)] p-5 md:col-start-2 md:p-6",
          "xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:border-l",
        )}
      >
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
          <dt className="mono-label">Post time</dt>
          <dd className="text-right font-mono text-[12px] text-bone tabular-nums">
            {pack.postAt ? (
              <time dateTime={pack.postAt}>{postTime.format(new Date(pack.postAt))}</time>
            ) : (
              <span className="text-bone-2">your call</span>
            )}
          </dd>
          <dt className="mono-label">Pack</dt>
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
      </div>
    </article>
  );
}

function Cover({ pack, concept, demo }: { pack: PublishPack; concept?: Concept; demo: boolean }) {
  const still = concept ? STILL_FORMATS.has(concept.format) : false;
  const { data: assets } = useConceptAssets(still ? undefined : pack.conceptId);
  const video = assets?.find((a) => a.id === pack.videoAssetId) ?? assets?.filter((a) => a.kind === "video").at(-1);
  const aspect = concept?.aspect ?? "9:16";
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 border-line border-b p-5 md:row-span-2 md:border-r md:border-b-0 xl:row-span-1",
        "bg-[rgb(0_0_0/0.22)]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(236 231 221 / 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgb(236 231 221 / 0.035) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, #000 20%, transparent 100%)",
        }}
      />
      <div className="relative w-full max-w-[192px]">
        {video ? (
          <PhoneFrame src={video.url} empty="Render missing" className="max-w-none" />
        ) : (
          <CoverTile title={concept?.title ?? CHANNEL_LABELS[pack.platform]} aspect={aspect} format={concept?.format} />
        )}
      </div>
      <div className="relative flex w-full max-w-[192px] items-center justify-between gap-2 font-mono text-[10.5px] text-bone-3">
        <span className="truncate tabular-nums">
          {video ? `${aspect} / ${video.durationSec ? `${Math.round(video.durationSec)} s` : "video"}` : aspect}
        </span>
        {demo && <DemoBadge label="Demo" />}
      </div>
    </div>
  );
}

/** Designed stand-in when there is no rendered file: the concept's title set as a cover at its aspect. */
function CoverTile({
  title,
  aspect,
  format,
}: {
  title: string;
  aspect: Concept["aspect"];
  format?: Concept["format"];
}) {
  const text = format === "text_post";
  return (
    <div
      className="relative w-full overflow-hidden rounded-card bg-raised-2 shadow-[inset_0_0_0_1px_var(--color-line-strong),0_24px_60px_-24px_rgb(0_0_0/0.9)]"
      style={{ aspectRatio: ASPECT_RATIO[aspect] }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: text
            ? "radial-gradient(90% 70% at 100% 0%, rgb(60 224 255 / 0.12), transparent 70%)"
            : "radial-gradient(110% 60% at 15% 0%, rgb(91 60 255 / 0.34), transparent 70%), radial-gradient(80% 50% at 100% 100%, rgb(60 224 255 / 0.16), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgb(6_7_10/0.7))]"
      />
      <div className="relative flex h-full flex-col justify-between p-3.5">
        <div className="flex items-center justify-between font-mono text-[9.5px] text-bone-3 uppercase tracking-[0.08em]">
          <span>{aspect}</span>
          <span className="truncate pl-2">{formatLabel(format) ?? "post"}</span>
        </div>
        <p
          className={cn(
            "text-bone",
            text ? "font-medium text-[15px] leading-snug" : "font-serif text-[21px] leading-[1.08]",
          )}
        >
          {title}
        </p>
        <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-bone-3 uppercase tracking-[0.08em]">
          <span className="size-1 rounded-full bg-bone-3" />
          {text ? "text only" : "no render yet"}
        </div>
      </div>
    </div>
  );
}

/** Ready to Posted: colours cross over and the label slides up (both labels share one grid cell, so no width jump). */
function StatusPill({ posted }: { posted: boolean }) {
  const label =
    "col-start-1 row-start-1 flex items-center gap-1.5 transition-[opacity,transform] duration-[380ms] ease-out";
  return (
    <span
      data-testid="pack-status"
      data-state={posted ? "posted" : "ready"}
      className={cn(
        "inline-grid h-6 shrink-0 items-center overflow-hidden rounded-chip px-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em]",
        "transition-[background-color,box-shadow,color] duration-[380ms] ease-out",
        posted
          ? "bg-[rgb(124_255_178/0.1)] text-pass shadow-[inset_0_0_0_1px_rgb(124_255_178/0.35)]"
          : "text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
      )}
    >
      <span aria-hidden={posted} className={cn(label, posted && "-translate-y-full opacity-0")}>
        <span className="size-1.5 rounded-full bg-signal shadow-[0_0_8px_rgb(212_255_58/0.7)]" />
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
      className={cn("h-7 min-w-[86px] px-2.5 font-mono text-[11px]", copied && "text-pass hover:text-pass")}
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
          className="h-px bg-signal shadow-[0_0_8px_rgb(212_255_58/0.6)] transition-[width] duration-500 ease-out"
          style={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-col gap-0.5">
        {items.map((it, i) => {
          const on = !!done[i];
          return (
            <li key={it}>
              <label className="-mx-2 flex cursor-pointer items-start gap-3 rounded-card px-2 py-1.5 transition-colors duration-150 hover:bg-glass">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={(e) => setDone((d) => d.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-4 shrink-0 place-items-center rounded-[4px] transition-[background-color,box-shadow] duration-200 ease-out",
                    "peer-focus-visible:outline-[1.5px] peer-focus-visible:outline-signal peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid",
                    on
                      ? "bg-signal shadow-[0_0_0_1px_rgb(212_255_58/0.7),0_0_12px_-2px_rgb(212_255_58/0.7)]"
                      : "shadow-[inset_0_0_0_1px_rgb(236_231_221/0.24)]",
                  )}
                >
                  <svg viewBox="0 0 12 12" className="size-3 text-ink" fill="none">
                    <path
                      d="M2.6 6.3 5 8.6l4.4-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={on ? 0 : 1}
                      className="transition-[stroke-dashoffset] delay-75 duration-[350ms] ease-out"
                    />
                  </svg>
                </span>
                <span
                  className={cn(
                    "text-ui transition-colors duration-200",
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
          {pack.postedAt && <span className="font-mono text-[11px] text-bone-3">posted {timeAgo(pack.postedAt)}</span>}
        </div>
        {safe ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-bone transition-colors hover:text-signal"
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
            <span className="font-mono text-[11px] text-bone-3">
              {latest.source === "manual" ? "entered" : "synced"} {timeAgo(latest.capturedAt)}
            </span>
          </div>
          <dl className="mt-2 flex flex-wrap gap-px overflow-hidden rounded-card bg-line p-px">
            {present.map((k) => (
              <div key={k} className="min-w-[30%] flex-1 bg-raised px-3 py-2.5">
                <dt className="font-mono text-[10px] text-bone-3 uppercase tracking-[0.08em]">{k}</dt>
                <dd className="mt-1 text-bone text-body">
                  <NumberTicker value={latest[k] ?? 0} from={0} />
                </dd>
              </div>
            ))}
            {Array.from({ length: (3 - (present.length % 3)) % 3 }, (_, i) => (
              <div key={`pad-${i}`} aria-hidden className="min-w-[30%] flex-1 bg-raised" />
            ))}
          </dl>
        </div>
      ) : (
        <p className="rounded-card px-3 py-2.5 font-mono text-[11px] text-bone-3 leading-relaxed shadow-[inset_0_0_0_1px_var(--color-line)]">
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
    <svg
      viewBox="0 0 16 16"
      className="size-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      fill="none"
      aria-hidden
    >
      <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
