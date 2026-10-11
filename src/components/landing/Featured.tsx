"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/client/format";
import { DATA_MODE } from "@/lib/client/mode";

export type FeaturedData = {
  winner: { title: string; author?: string; url?: string; thumbnailUrl?: string; views?: number; outlier?: number };
  blueprint: { id: string; durationSec: number; shots: number; structure: string; mechanism: string };
  remake: { title: string; videoUrl: string; posterUrl: string; review?: { overall: number; minShot: number } };
  runId: string;
};

/** The winner and our remake side by side: the one picture that explains the product. */
export function Featured({ data: d }: { data: FeaturedData }) {
  // the showcase run is imported by the engine; mock mode links to the demo run's blueprint instead
  const href =
    DATA_MODE === "live"
      ? `/runs/${d.runId}/blueprints/${d.blueprint.id}`
      : "/runs/run_hound_demo/blueprints/bp_hound_1";
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" data-testid="featured">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-[#222] lg:col-span-7">
        <Viewer label="The winner" sub={d.winner.author ?? "TikTok"}>
          <Still src={d.winner.thumbnailUrl} href={d.winner.url} />
        </Viewer>
        <Viewer label="Our remake for Hound" sub={`${d.blueprint.shots} shots, same structure`}>
          <LoopVideo src={d.remake.videoUrl} poster={d.remake.posterUrl} />
        </Viewer>
      </div>
      <div className="flex flex-col justify-center gap-5 lg:col-span-5">
        <dl className="grid grid-cols-3 border-line border-y py-3">
          {d.winner.views != null && <Stat k="Views" v={formatCount(d.winner.views)} />}
          {d.winner.outlier != null && <Stat k="vs account median" v={`${d.winner.outlier.toFixed(1)}x`} />}
          {d.remake.review && <Stat k="Self-review" v={`${d.remake.review.overall}/100`} />}
        </dl>
        <div>
          <h3 className="line-clamp-3 font-semibold text-[17px] tracking-[-0.01em]">
            &ldquo;{d.winner.title.replace(/^["“”]+|["“”]+$/g, "")}&rdquo;
          </h3>
          <p className="mt-2 text-[14px] text-bone-2 leading-relaxed">
            Kept: the {d.blueprint.structure.replaceAll("_", " ")} structure, the hook mechanism (
            {firstClause(d.blueprint.mechanism)}), the pacing over {d.blueprint.shots} shots. Changed: the product, the
            people, the words and every frame.
            {d.remake.review
              ? ` Every shot scored ${d.remake.review.minShot} or more when the agent watched its own cut.`
              : ""}
          </p>
        </div>
        <div>
          <Link
            href={href}
            className="inline-flex h-10 items-center rounded-chip bg-signal px-4 font-medium text-[14px] text-white hover:bg-[#cf2b26]"
          >
            Open the side by side
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Muted loop that starts after the page has loaded, so the video never holds back the load event. */
function LoopVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = () => {
      v.src = src;
      v.play().catch(() => {});
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [src]);
  return (
    <video
      ref={ref}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

const firstClause = (s: string) =>
  s
    .split(/[:;,.]/)[0]
    .trim()
    .toLowerCase();

function Viewer({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <figure className="relative bg-viewer">
      <div className="relative mx-auto aspect-[9/16] max-h-[460px] w-full">{children}</div>
      <figcaption className="absolute top-3 left-3 flex flex-col gap-0.5">
        <span className="w-fit rounded-[3px] bg-black/70 px-1.5 py-1 font-semibold text-[10px] text-white uppercase tracking-[0.06em]">
          {label}
        </span>
        <span className="w-fit rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[11px] text-white/80">{sub}</span>
      </figcaption>
    </figure>
  );
}

function Still({ src, href }: { src?: string; href?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[13px] text-white/60">
        Thumbnail not available here.
      </div>
    );
  const img = (
    // biome-ignore lint/performance/noImgElement: third-party thumbnail, linked to its source
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="absolute inset-0">
      {img}
    </a>
  ) : (
    img
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-bone-3">{k}</dt>
      <dd className="mt-0.5 font-mono text-[15px] text-bone">{v}</dd>
    </div>
  );
}
