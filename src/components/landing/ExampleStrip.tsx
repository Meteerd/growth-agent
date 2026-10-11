"use client";

import { useEffect, useState } from "react";
import { API, type Asset, type Blueprint, type Concept, type Run } from "@/contracts";
import { formatCount, SOURCE_LABELS } from "@/lib/client/format";
import { DATA_MODE } from "@/lib/client/mode";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";

export type Winner = {
  id: string;
  source: keyof typeof SOURCE_LABELS;
  title: string;
  thumbnailUrl: string;
  url?: string;
  views?: number;
  outlier?: number;
  daysRunning?: number;
};

type Frames = { bp: Blueprint; frames: { t: number; url: string }[] };

/**
 * Proof over decoration: real winning posts the agent found for Hound (top), and what it made (bottom).
 * In live mode it upgrades to one analysed ad's actual frames and the engine's generated keyframes.
 */
export function ExampleStrip({
  winners,
  brandArt,
  compact,
}: {
  winners: Winner[];
  brandArt: string[];
  compact?: boolean;
}) {
  const [frames, setFrames] = useState<Frames>();
  const [keyframes, setKeyframes] = useState<string[]>([]);

  useEffect(() => {
    if (DATA_MODE !== "live") return;
    let stop = false;
    const get = <T,>(u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r.status)));
    (async () => {
      const runs = await get<Run[]>(API.brandRuns("hound"));
      const recorded = runs.find((r) => r.dataset === "live_recorded");
      if (recorded) {
        const bps = await get<Blueprint[]>(API.runBlueprints(recorded.id));
        const bp = bps.find((b) => b.frames.length >= 4);
        if (bp && !stop) {
          const step = Math.max(1, Math.floor(bp.frames.length / 6));
          setFrames({ bp, frames: bp.frames.filter((_, i) => i % step === 0).slice(0, 6) });
        }
      }
      const concepts = await get<Concept[]>(API.runConcepts("run_hound_demo"));
      const remake = concepts.find((c) => c.blueprintId && !c.variantOf);
      if (remake) {
        const assets = await get<Asset[]>(API.conceptAssets(remake.id));
        const kfs = assets.filter((a) => a.kind === "keyframe").sort((a, b) => (a.shotIdx ?? 0) - (b.shotIdx ?? 0));
        if (kfs.length && !stop) setKeyframes(kfs.map((a) => a.url).slice(0, 6));
      }
    })().catch(() => {});
    return () => {
      stop = true;
    };
  }, []);

  const ours = keyframes.length ? keyframes : brandArt.slice(0, 6);
  if (compact)
    return (
      <Row label="Other winners the agent found for Hound" note="Real posts, linked to the source; never re-uploaded.">
        {winners.map((w) => (
          <Frame
            key={w.id}
            src={w.thumbnailUrl}
            href={w.url}
            caption={[
              w.outlier ? `${w.outlier.toFixed(1)}x median` : "",
              w.views ? `${formatCount(w.views)} views` : "",
            ]
              .filter(Boolean)
              .join(" / ")}
            sub={SOURCE_LABELS[w.source]}
          />
        ))}
      </Row>
    );
  return (
    <div className="flex flex-col gap-6">
      <Row
        label={frames ? "The winner, frame by frame" : "What is winning in the niche"}
        note={
          frames
            ? `${frames.bp.durationSec}s, ${frames.bp.shots.length} shots. Analysed locally; never re-uploaded.`
            : "Real posts the agent found on 11 Oct. Linked to the source; never re-uploaded."
        }
      >
        {frames
          ? frames.frames.map((f) => <Frame key={f.t} src={f.url} caption={`${f.t.toFixed(1)}s`} />)
          : winners.map((w) => (
              <Frame
                key={w.id}
                src={w.thumbnailUrl}
                href={w.url}
                caption={[
                  w.outlier ? `${w.outlier.toFixed(1)}x median` : "",
                  w.views ? `${formatCount(w.views)} views` : "",
                ]
                  .filter(Boolean)
                  .join(" / ")}
                sub={SOURCE_LABELS[w.source]}
              />
            ))}
      </Row>
      <div className="flex h-2 gap-[3px]" aria-hidden>
        {(["hook", "problem", "solution", "demo", "proof", "cta"] as const).map((p) => (
          <span key={p} className="flex-1" style={{ background: PURPOSE_COLOR[p] }} title={PURPOSE_LABEL[p]} />
        ))}
      </div>
      <Row
        label="What Nexus made for Hound"
        note={
          keyframes.length
            ? "Generated keyframes, one per shot, in Hound's illustration style."
            : "Hound's own brand art: the style the keyframes are generated in."
        }
      >
        {ours.map((src, i) => (
          <Frame key={src} src={src} caption={`shot ${i + 1}`} />
        ))}
      </Row>
    </div>
  );
}

function Row({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-[15px] text-bone">{label}</h3>
        <p className="text-[12.5px] text-bone-2">{note}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">{children}</div>
    </div>
  );
}

function Frame({ src, caption, sub, href }: { src: string; caption?: string; sub?: string; href?: string }) {
  const [broken, setBroken] = useState(false);
  const img = broken ? (
    <div className="grid h-full w-full place-items-center bg-raised-2 p-3 text-center text-[11px] text-bone-3">
      image not available here
    </div>
  ) : (
    // biome-ignore lint/performance/noImgElement: third-party thumbnails and engine assets, sized by the grid
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  );
  return (
    <figure className="min-w-0">
      <div className="aspect-[9/16] overflow-hidden rounded-[4px] bg-viewer">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="block h-full">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
      {(caption || sub) && (
        <figcaption className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-bone">{caption}</span>
          {sub && <span className="shrink-0 text-[11px] text-bone-3">{sub}</span>}
        </figcaption>
      )}
    </figure>
  );
}
