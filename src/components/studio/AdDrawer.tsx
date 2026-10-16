"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/client/cn";
import { type Ad, api, useRefresh } from "@/lib/client/studio";
import { STATUS_TONE } from "./Brand";

function Score({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11.5px] text-bone-3">
        <span>{label}</span>
        <span className="font-mono">{v}</span>
      </div>
      <div className="mt-1 h-1 rounded bg-line">
        <div
          className={cn("h-full rounded", v >= 80 ? "bg-pass" : v >= 65 ? "bg-bone" : "bg-warn")}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

/** One ad: the slides big, its copy (editable), why it exists, compliance, review, versions and actions. */
export function AdDrawer({ ad, onClose, refreshAds }: { ad: Ad; onClose: () => void; refreshAds: () => void }) {
  const [version, setVersion] = useState<number | null>(null);
  const slides = version === null ? ad.body.slides : (ad.body.versions[version]?.slides ?? ad.body.slides);
  const [i, setI] = useState(0);
  const [copy, setCopy] = useState(ad.body.copy);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  useEffect(() => setCopy(ad.body.copy), [ad.body.copy]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, slides.length]);
  const s = slides[Math.min(i, slides.length - 1)];
  const r = ad.body.review;
  async function setStatus(status: "approved" | "rejected" | "ready") {
    await api.patch(`/ads/${ad.id}`, { status });
    refreshAds();
    refresh();
  }
  async function saveCopy() {
    await api.patch(`/ads/${ad.id}`, { copy });
    toast({ title: "Copy saved", tone: "pass" });
    refreshAds();
  }
  async function revise() {
    if (!feedback.trim()) return;
    setBusy(true);
    try {
      await api.post(`/ads/${ad.id}/revise`, { feedback });
      toast({ title: "Revising", body: "The new version appears here in a minute or two." });
      setFeedback("");
      refresh();
    } catch (e) {
      toast({ title: "Could not revise", body: e instanceof Error ? e.message : String(e), tone: "fail" });
    } finally {
      setBusy(false);
    }
  }
  const field = "w-full rounded-md border border-line px-2.5 py-1.5 text-[13px] outline-none focus:border-line-strong";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes the dialog (Esc also closes)
    <div
      className="fixed inset-0 z-50 flex bg-black/40"
      onClick={onClose}
      onKeyDown={() => undefined}
      role="presentation"
    >
      <div
        className="ml-auto flex h-full w-full max-w-[1180px] overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => undefined}
        role="dialog"
      >
        <div className="flex flex-1 flex-col bg-[#1A1A1A]">
          <div className="flex items-center justify-between px-5 py-3 text-[12.5px] text-white/70">
            <span>
              {ad.kind === "carousel" ? `Slide ${i + 1} of ${slides.length}` : "Static"} · {ad.body.aspect} ·{" "}
              {ad.body.language}
            </span>
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
              Close
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
            {s?.png ? (
              // biome-ignore lint/performance/noImgElement: generated slide
              <img src={s.png} alt="" className="max-h-full max-w-full rounded shadow-2xl" />
            ) : (
              <div className="text-[13px] text-white/60">
                {ad.status === "failed" ? (ad.body.error ?? "Failed") : "Rendering..."}
              </div>
            )}
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setI((x) => Math.max(0, x - 1))}
                  className="absolute left-3 rounded-full bg-white/15 px-3 py-2 text-white hover:bg-white/25"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}
                  className="absolute right-3 rounded-full bg-white/15 px-3 py-2 text-white hover:bg-white/25"
                >
                  Next
                </button>
              </>
            )}
          </div>
          {slides.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3">
              {slides.map((x, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setI(j)}
                  className={cn(
                    "h-20 shrink-0 overflow-hidden rounded border-2",
                    j === i ? "border-white" : "border-transparent opacity-60",
                  )}
                >
                  {x.png && (
                    // biome-ignore lint/performance/noImgElement: thumb
                    <img src={x.png} alt="" className="h-full" />
                  )}
                </button>
              ))}
            </div>
          )}
          {s?.image.source === "generated" && s.image.prompt && (
            <div className="px-5 pb-3 text-[11.5px] text-white/45">
              Image: {s.image.model} · {s.image.prompt.slice(0, 220)}
            </div>
          )}
        </div>
        <div className="w-[420px] shrink-0 overflow-y-auto border-line border-l p-5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide", STATUS_TONE[ad.status])}>
              {ad.status}
            </span>
            <span className="text-bone-3">{ad.format.replace(/_/g, " ")}</span>
            {ad.score ? <span className="ml-auto font-mono text-[12px]">score {ad.score}</span> : null}
          </div>
          <h2 className="mt-2 font-semibold text-[17px] leading-snug">{ad.body.title}</h2>
          <p className="mt-1 text-bone-2">{ad.body.rationale}</p>
          <div className="mt-2 text-[12px] text-bone-3">
            Angle: {ad.body.angle} · For: {ad.body.persona}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus("approved")}
              className="rounded-md bg-pass px-3 py-1.5 text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setStatus("rejected")}
              className="rounded-md border border-line px-3 py-1.5"
            >
              Reject
            </button>
            <a href={`/api/studio/ads/${ad.id}/download`} className="rounded-md border border-line px-3 py-1.5">
              Download
            </a>
          </div>
          <div className="mt-5">
            <div className="font-medium">Change it</div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="e.g. make the headline about the 10 minutes, use a photo of an older dog, swap slide 3 for a comparison"
              className={cn(field, "mt-2 resize-none")}
            />
            <button
              type="button"
              onClick={revise}
              disabled={busy || !feedback.trim()}
              className="mt-2 rounded-md bg-bone px-3 py-1.5 text-white disabled:opacity-40"
            >
              {busy ? "Starting..." : "Revise"}
            </button>
          </div>
          <div className="mt-5 space-y-2">
            <div className="font-medium">Ads Manager copy</div>
            <label className="block text-[11.5px] text-bone-3">
              Primary text
              <textarea
                value={copy.primaryText}
                onChange={(e) => setCopy({ ...copy, primaryText: e.target.value })}
                rows={5}
                className={cn(field, "mt-1 resize-y")}
              />
            </label>
            <label className="block text-[11.5px] text-bone-3">
              Headline ({copy.headline.length})
              <input
                value={copy.headline}
                onChange={(e) => setCopy({ ...copy, headline: e.target.value })}
                className={cn(field, "mt-1")}
              />
            </label>
            <label className="block text-[11.5px] text-bone-3">
              Description
              <input
                value={copy.description}
                onChange={(e) => setCopy({ ...copy, description: e.target.value })}
                className={cn(field, "mt-1")}
              />
            </label>
            <label className="block text-[11.5px] text-bone-3">
              Button
              <input
                value={copy.cta}
                onChange={(e) => setCopy({ ...copy, cta: e.target.value })}
                className={cn(field, "mt-1")}
              />
            </label>
            {JSON.stringify(copy) !== JSON.stringify(ad.body.copy) && (
              <button type="button" onClick={saveCopy} className="rounded-md bg-bone px-3 py-1.5 text-white">
                Save copy
              </button>
            )}
          </div>
          {r && (
            <div className="mt-5 space-y-2">
              <div className="font-medium">Review</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Score label="Stop power" v={r.stopPower} />
                <Score label="Clarity" v={r.clarity} />
                <Score label="Brand fit" v={r.brandFit} />
                <Score label="Craft" v={r.craft} />
              </div>
              {!r.textCorrect && <div className="text-warn">Some text does not read as intended.</div>}
              {r.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-bone-2">
                  {r.issues.map((x, j) => (
                    <li key={j}>{x}</li>
                  ))}
                </ul>
              )}
              {r.fix && <div className="text-bone-2">Best next change: {r.fix}</div>}
            </div>
          )}
          {ad.body.compliance && (
            <div className="mt-5">
              <div className="font-medium">
                Compliance:{" "}
                <span
                  className={
                    ad.body.compliance.status === "pass"
                      ? "text-pass"
                      : ad.body.compliance.status === "warn"
                        ? "text-warn"
                        : "text-fail"
                  }
                >
                  {ad.body.compliance.status}
                </span>
              </div>
              {ad.body.compliance.findings.filter((f) => f.severity !== "info").length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-bone-2">
                  {ad.body.compliance.findings
                    .filter((f) => f.severity !== "info")
                    .map((f, j) => (
                      <li key={j}>
                        <span className="font-mono text-[11px]">{f.ruleId}</span> {f.message}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {ad.body.versions.length > 1 && (
            <div className="mt-5">
              <div className="font-medium">Versions</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ad.body.versions.map((v, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      setVersion(j === ad.body.versions.length - 1 ? null : j);
                      setI(0);
                    }}
                    className={cn(
                      "rounded border px-2 py-1 text-[12px]",
                      (version ?? ad.body.versions.length - 1) === j ? "border-bone" : "border-line text-bone-2",
                    )}
                  >
                    v{j + 1} {v.review ? `· ${v.review.overall}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ad.body.feedback.length > 0 && (
            <div className="mt-5">
              <div className="font-medium">Your notes</div>
              <ul className="mt-1 space-y-1 text-bone-2">
                {ad.body.feedback.map((f, j) => (
                  <li key={j}>{f.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
