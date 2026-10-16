"use client";

import { useState } from "react";
import { cn } from "@/lib/client/cn";
import { type AdRef, type Playbook, useRefs } from "@/lib/client/studio";

function RefModal({ r, onClose }: { r: AdRef; onClose: () => void }) {
  const a = r.body.analysis;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes the dialog (Esc also closes)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
      onKeyDown={() => undefined}
      role="presentation"
    >
      <div
        className="flex max-h-full w-full max-w-5xl overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => undefined}
        role="dialog"
      >
        <div className="flex flex-1 gap-2 overflow-x-auto bg-[#1A1A1A] p-4">
          {r.body.images.map((u) => (
            // biome-ignore lint/performance/noImgElement: competitor ad
            <img key={u} src={u} alt="" className="max-h-[75vh] rounded object-contain" />
          ))}
        </div>
        <div className="w-[380px] shrink-0 overflow-y-auto p-5 text-[13px]">
          <div className="font-semibold text-[16px]">{r.advertiser}</div>
          <div className="mt-1 text-bone-3">
            {r.mediaType === "video_cover" ? "Video ad (cover frame)" : r.mediaType} ·{" "}
            {r.body.active ? "running" : "stopped"} {r.body.daysRunning ?? "?"} days · {r.body.variants ?? 1} ads use
            this creative · {r.body.country}
          </div>
          {r.body.adLibraryUrl && (
            <a
              href={r.body.adLibraryUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block underline decoration-line-strong"
            >
              Open in the Meta Ad Library
            </a>
          )}
          {r.body.body && <p className="mt-3 whitespace-pre-wrap text-bone-2">{r.body.body.slice(0, 600)}</p>}
          {a && (
            <dl className="mt-4 space-y-2.5">
              {[
                ["Format", a.format.replace(/_/g, " ")],
                ["Hook", a.hook],
                ["Angle", a.angle],
                ["For", a.persona],
                ["Layout", a.layout],
                ["Look", a.visualStyle],
                ["Offer", a.offer],
                ["Why it wins", a.whyItWins],
                ["What to take", a.steal],
                ["What not to copy", a.avoid],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11.5px] text-bone-3">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              {a.slides.length > 0 && (
                <div>
                  <dt className="text-[11.5px] text-bone-3">Cards</dt>
                  <dd>
                    <ol className="list-decimal pl-4">
                      {a.slides.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ol>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

export function Competitors({ slug }: { slug: string }) {
  const refs = useRefs(slug);
  const [adv, setAdv] = useState("all");
  const [open, setOpen] = useState<AdRef | null>(null);
  const [hideIrrelevant, setHide] = useState(true);
  const all = (refs.data ?? []).filter((r) => !hideIrrelevant || !r.body.analysis?.irrelevant);
  const advertisers = [...new Set(all.map((r) => r.advertiser))];
  const list = all.filter((r) => adv === "all" || r.advertiser === adv);
  if (!refs.data?.length)
    return (
      <div className="rounded-xl border border-line border-dashed bg-white px-6 py-12 text-center text-[13.5px] text-bone-2">
        No competitor ads yet. Press Scan competitors.
      </div>
    );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={adv}
          onChange={(e) => setAdv(e.target.value)}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
        >
          <option value="all">All advertisers ({all.length})</option>
          {advertisers.map((a) => (
            <option key={a} value={a}>
              {a} ({all.filter((r) => r.advertiser === a).length})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-bone-2">
          <input type="checkbox" checked={hideIrrelevant} onChange={(e) => setHide(e.target.checked)} /> Hide unrelated
          ads
        </label>
        <span className="ml-auto text-[12px] text-bone-3">
          Ranked by how long they run, how many ads reuse the creative, and the teardown.
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {list.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(r)}
            className="overflow-hidden rounded-xl border border-line bg-white text-left hover:border-line-strong"
          >
            <div className="relative aspect-[4/5] bg-[#EDEBE6]">
              {r.body.images[0] && (
                // biome-ignore lint/performance/noImgElement: competitor ad
                <img src={r.body.images[0]} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
              )}
              <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
                {r.score}
              </span>
              {r.mediaType !== "image" && (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white">
                  {r.mediaType === "carousel" ? `${r.body.images.length} cards` : "video"}
                </span>
              )}
            </div>
            <div className="p-2.5">
              <div className="truncate font-medium text-[12.5px]">{r.advertiser}</div>
              <div className="text-[11.5px] text-bone-3">
                {r.body.daysRunning ?? "?"}d · {r.body.variants ?? 1}x{" "}
                {r.body.active && <span className="text-pass">· live</span>}
              </div>
              {r.body.analysis && (
                <div
                  className={cn(
                    "mt-1 line-clamp-2 text-[12px]",
                    r.body.analysis.irrelevant ? "text-bone-3" : "text-bone-2",
                  )}
                >
                  {r.body.analysis.hook}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {open && <RefModal r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function PlaybookView({ slug, playbook }: { slug: string; playbook: Playbook | null }) {
  const refs = useRefs(slug);
  if (!playbook)
    return (
      <div className="rounded-xl border border-line border-dashed bg-white px-6 py-12 text-center text-[13.5px] text-bone-2">
        No playbook yet. Scan the competitors, then press Analyse.
      </div>
    );
  const thumb = (id: string) => refs.data?.find((r) => r.id === id)?.body.images[0];
  return (
    <div className="space-y-8 text-[14px]">
      <div className="max-w-3xl">
        <div className="text-[12px] text-bone-3">
          From {playbook.refCount} competitor ads · {new Date(playbook.createdAt).toLocaleString()}
        </div>
        <p className="mt-2 text-[16px] leading-relaxed">{playbook.summary}</p>
      </div>
      <div>
        <h3 className="font-medium text-[15px]">What wins here</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {playbook.patterns.map((p) => (
            <div key={p.name} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-[12px] text-bone-3">{p.share}</span>
              </div>
              <div className="mt-0.5 text-[12px] text-bone-3">{p.format.replace(/_/g, " ")}</div>
              <p className="mt-2 text-bone-2">{p.why}</p>
              <p className="mt-2">
                <span className="text-bone-3">For us: </span>
                {p.howWeUseIt}
              </p>
              <div className="mt-3 flex gap-1.5">
                {p.refIds.slice(0, 5).map((id) =>
                  thumb(id) ? (
                    // biome-ignore lint/performance/noImgElement: thumb
                    <img key={id} src={thumb(id)} alt="" className="h-16 w-13 rounded object-cover" />
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-medium text-[15px]">Angles competitors use</h3>
          <ul className="mt-2 space-y-3">
            {playbook.angles.map((a) => (
              <li key={a.angle}>
                <div className="font-medium">{a.angle}</div>
                <div className="text-bone-2">{a.evidence}</div>
                <div className="text-bone-2">
                  <span className="text-bone-3">Our move: </span>
                  {a.forUs}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-[15px]">White space</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-bone-2">
              {playbook.whiteSpace.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-[15px]">Category norms</h3>
            <p className="mt-2 text-bone-2">{playbook.visualNorms}</p>
            <p className="mt-2 text-bone-2">{playbook.copyNorms}</p>
          </div>
          <div>
            <h3 className="font-medium text-[15px]">Do not</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-bone-2">
              {playbook.doNot.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
