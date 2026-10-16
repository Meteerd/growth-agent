"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/client/cn";
import { type Ad, api, type BrandDetail, useAds, useBrand, useRefresh } from "@/lib/client/studio";
import { AdDrawer } from "./AdDrawer";
import { Competitors, PlaybookView } from "./Competitors";
import { JobList } from "./Jobs";
import { Kit } from "./Kit";

const TABS = ["Ads", "Competitors", "Playbook", "Brand kit", "Jobs"] as const;
type Tab = (typeof TABS)[number];

export const STATUS_TONE: Record<string, string> = {
  queued: "bg-bone-4/30 text-bone-2",
  rendering: "bg-signal-dim text-signal",
  ready: "bg-[#EEF3FF] text-[#2A4FA8]",
  below_bar: "bg-[#FBF1DE] text-warn",
  approved: "bg-[#E7F3EC] text-pass",
  rejected: "bg-[#F4ECEB] text-fail",
  failed: "bg-[#F4ECEB] text-fail",
};

function GeneratePanel({ d, slug, onStarted }: { d: BrandDetail; slug: string; onStarted: () => void }) {
  const [count, setCount] = useState(6);
  const [carousels, setCarousels] = useState(2);
  const [language, setLanguage] = useState(d.config.defaultLanguage);
  const [aspect, setAspect] = useState(d.config.aspects[0] ?? "4:5");
  const [model, setModel] = useState(d.config.imageModel);
  const [formats, setFormats] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [good, setGood] = useState(0);
  const [busy, setBusy] = useState(false);
  const info = d.imageModels.find((m) => m.id === model);
  const est = info ? (count - carousels + carousels * 5) * info.usd * 1.3 + count * 0.25 : 0;
  async function go() {
    setBusy(true);
    try {
      await api.post(`/brands/${slug}/generate`, {
        count,
        carousels,
        language,
        aspect,
        model,
        formats: formats.length ? formats : undefined,
        notes: notes || undefined,
        good: good || undefined,
      });
      toast({
        title: "Generating",
        body: `${count} ads. About 1 to 3 minutes each; they appear on the board as they finish.`,
      });
      onStarted();
    } catch (e) {
      toast({ title: "Could not start", body: e instanceof Error ? e.message : String(e), tone: "fail" });
    } finally {
      setBusy(false);
    }
  }
  const sel = "rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]";
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-[12px] text-bone-3">
          Ads
          <input
            type="number"
            min={1}
            max={12}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={cn(sel, "mt-1 block w-20")}
          />
        </label>
        <label className="text-[12px] text-bone-3">
          Of which carousels
          <input
            type="number"
            min={0}
            max={count}
            value={carousels}
            onChange={(e) => setCarousels(Number(e.target.value))}
            className={cn(sel, "mt-1 block w-20")}
          />
        </label>
        <label
          className="text-[12px] text-bone-3"
          title="Keep making new concepts until this many ads score at or above the quality bar"
        >
          Keep going until good
          <input
            type="number"
            min={0}
            max={count}
            value={good}
            onChange={(e) => setGood(Number(e.target.value))}
            className={cn(sel, "mt-1 block w-20")}
          />
        </label>
        <label className="text-[12px] text-bone-3">
          Language
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={cn(sel, "mt-1 block")}>
            {[...new Set([...d.config.languages, d.config.defaultLanguage, "en"])].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-bone-3">
          Size
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as typeof aspect)}
            className={cn(sel, "mt-1 block")}
          >
            <option value="4:5">4:5 feed</option>
            <option value="1:1">1:1 square</option>
            <option value="9:16">9:16 stories</option>
          </select>
        </label>
        <label className="text-[12px] text-bone-3">
          Image model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            className={cn(sel, "mt-1 block")}
          >
            {d.imageModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (${m.usd.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto text-right text-[12px] text-bone-3">
          about ${est.toFixed(2)}
          <button
            type="button"
            onClick={go}
            disabled={busy}
            className="ml-3 rounded-md bg-signal px-4 py-2 text-[13.5px] text-white disabled:opacity-40"
          >
            {busy ? "Starting..." : "Generate"}
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {d.formats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormats((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px]",
              formats.includes(f.id)
                ? "border-bone bg-bone text-white"
                : "border-line text-bone-2 hover:border-line-strong",
            )}
          >
            {f.name}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Brief for this batch (optional): an angle, a persona, an offer, what to avoid. Leave formats empty to let the playbook decide."
        className="mt-3 w-full resize-none rounded-md border border-line px-3 py-2 text-[13.5px] outline-none focus:border-line-strong"
      />
      {info && <div className="mt-1 text-[12px] text-bone-3">{info.note}</div>}
    </div>
  );
}

function AdCard({ a, onOpen }: { a: Ad; onOpen: () => void }) {
  const cover = a.body.slides[0]?.png;
  const ratio = a.body.aspect === "1:1" ? "aspect-square" : a.body.aspect === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-line bg-white text-left hover:border-line-strong"
    >
      <div className={cn("relative overflow-hidden bg-[#EDEBE6]", ratio)}>
        {cover ? (
          // biome-ignore lint/performance/noImgElement: generated slides
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center px-6 text-center text-[12.5px] text-bone-3">
            {a.status === "failed" ? (a.body.error ?? "Failed") : a.status === "rendering" ? "Rendering..." : "Queued"}
          </div>
        )}
        {a.kind === "carousel" && a.body.slides.length > 1 && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {a.body.slides.length} slides
          </span>
        )}
        {a.score !== null && a.score > 0 && (
          <span
            className={cn(
              "absolute top-2 right-2 rounded-full px-2 py-0.5 font-mono text-[11px] text-white",
              a.score >= 80 ? "bg-pass" : a.score >= 65 ? "bg-black/60" : "bg-warn",
            )}
          >
            {a.score}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide", STATUS_TONE[a.status])}>
            {a.status}
          </span>
          {a.body.compliance?.status === "warn" && (
            <span className="rounded bg-[#FBF1DE] px-1.5 py-0.5 text-[10.5px] text-warn uppercase">check</span>
          )}
          <span className="truncate text-[11.5px] text-bone-3">{a.format.replace(/_/g, " ")}</span>
        </div>
        <div className="mt-1.5 line-clamp-2 font-medium text-[13px]">{a.body.title}</div>
      </div>
    </button>
  );
}

function AdsBoard({ slug, d }: { slug: string; d: BrandDetail }) {
  const running = d.jobs.some((j) => j.status === "running" || j.status === "queued");
  const ads = useAds(slug, running);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const refresh = useRefresh();
  const list = (ads.data ?? []).filter((a) => filter === "all" || a.status === filter);
  const batches = [...new Set(list.map((a) => a.batchId))];
  const opened = ads.data?.find((a) => a.id === open) ?? null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {["all", "ready", "below_bar", "approved", "rejected", "failed"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] capitalize",
              filter === f ? "bg-bone text-white" : "text-bone-2 hover:bg-white",
            )}
          >
            {f.replace("_", " ")}
            {f !== "all" && ` ${(ads.data ?? []).filter((a) => a.status === f).length}`}
          </button>
        ))}
        <a
          href={`/api/studio/brands/${slug}/export?status=${filter === "all" ? "approved" : filter}`}
          className="ml-auto rounded-md border border-line bg-white px-3 py-2 text-[13px] hover:border-line-strong"
        >
          Download {filter === "all" ? "approved" : filter}
        </a>
        <button
          type="button"
          onClick={() => setGen((g) => !g)}
          className="rounded-md bg-bone px-4 py-2 text-[13.5px] text-white"
        >
          {gen ? "Close" : "Make ads"}
        </button>
      </div>
      {gen && (
        <div className="mt-4">
          <GeneratePanel
            d={d}
            slug={slug}
            onStarted={() => {
              setGen(false);
              refresh();
            }}
          />
        </div>
      )}
      {!list.length && (
        <div className="mt-6 rounded-xl border border-line border-dashed bg-white px-6 py-12 text-center text-[13.5px] text-bone-2">
          No ads yet.{" "}
          {d.counts.refs
            ? "Press Make ads, or ask the agent."
            : "Scan the competitors first (Competitors tab), then make ads, or ask the agent to do all of it."}
        </div>
      )}
      {batches.map((b) => {
        const items = list.filter((a) => a.batchId === b);
        return (
          <div key={b} className="mt-6">
            <div className="mb-2 text-[12px] text-bone-3">
              Batch of {items.length} · {new Date(items[0]!.createdAt).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {items.map((a) => (
                <AdCard key={a.id} a={a} onOpen={() => setOpen(a.id)} />
              ))}
            </div>
          </div>
        );
      })}
      {opened && <AdDrawer ad={opened} onClose={() => setOpen(null)} refreshAds={() => ads.refetch()} />}
    </div>
  );
}

export function BrandWorkspace({ slug }: { slug: string }) {
  const q = useBrand(slug);
  const [tab, setTab] = useState<Tab>("Ads");
  const refresh = useRefresh();
  const d = q.data;
  if (q.isError) return <div className="p-10 text-[14px] text-fail">{(q.error as Error).message}</div>;
  if (!d) return <div className="p-10 text-[14px] text-bone-3">Loading...</div>;
  const running = d.jobs.filter((j) => j.status === "running" || j.status === "queued");
  async function start(kind: "scan" | "analyze") {
    try {
      await api.post(`/brands/${slug}/${kind}`, {});
      toast({
        title: kind === "scan" ? "Scanning competitor ads" : "Taking the ads apart",
        body: "Follow it under Jobs.",
      });
      refresh();
    } catch (e) {
      toast({ title: "Could not start", body: e instanceof Error ? e.message : String(e), tone: "fail" });
    }
  }
  return (
    <div className="mx-auto max-w-7xl px-6 py-7 md:px-10">
      <div className="flex flex-wrap items-center gap-4">
        {d.config.logo && (
          // biome-ignore lint/performance/noImgElement: logo
          <img
            src={d.config.logo}
            alt=""
            className="size-12 rounded-lg border border-line bg-white object-contain p-1"
          />
        )}
        <div className="min-w-0">
          <h1 className="font-semibold text-[26px] tracking-tight">{d.brand.name}</h1>
          <div className="text-[13px] text-bone-2">
            {d.brand.dossier.oneLiner} · {d.brand.countries.join(", ")} ·{" "}
            <a href={d.brand.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong">
              {d.config.ctaUrl}
            </a>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => start("scan")}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[13px] hover:border-line-strong"
          >
            Scan competitors
          </button>
          <button
            type="button"
            onClick={() => start("analyze")}
            disabled={!d.counts.refs}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-[13px] hover:border-line-strong disabled:opacity-40"
          >
            Analyse and write playbook
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          {
            label: "Brand kit",
            done: !!(d.config.logo || d.config.logoStyle === "wordmark") && d.config.brandImages.length > 0,
            note: `${d.config.brandImages.length} images, ${d.config.competitors.length} competitors`,
          },
          {
            label: "Competitor ads",
            done: d.counts.refs > 0,
            note: d.counts.refs ? `${d.counts.refs} found` : "Scan competitors",
          },
          {
            label: "Playbook",
            done: !!d.playbook,
            note: d.playbook
              ? `${d.playbook.patterns.length} winning patterns`
              : d.counts.refs
                ? "Analyse"
                : "after the scan",
          },
          { label: "Ads", done: d.counts.ads > 0, note: d.counts.ads ? `${d.counts.ads} made` : "Make ads" },
          {
            label: "Approved",
            done: d.counts.approved > 0,
            note: d.counts.approved ? `${d.counts.approved} ready to upload` : "review the board",
          },
        ].map((x, i) => (
          <div
            key={x.label}
            className={cn(
              "rounded-lg border px-3 py-2",
              x.done ? "border-line bg-white" : "border-dashed border-line-strong bg-transparent",
            )}
          >
            <div className="flex items-center gap-2 text-[12.5px] font-medium">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  x.done ? "bg-pass text-white" : "border border-line-strong text-bone-3",
                )}
              >
                {x.done ? "✓" : i + 1}
              </span>
              {x.label}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-bone-3">{x.note}</div>
          </div>
        ))}
      </div>
      {running.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {running.map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-2.5 text-[13px]">
              <span className="size-1.5 animate-pulse rounded-full bg-signal" />
              <span className="font-medium capitalize">{j.kind}</span>
              <span className="truncate text-bone-2">{j.step}</span>
              <div className="ml-auto h-1 w-40 overflow-hidden rounded bg-line">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${Math.round(j.progress * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex gap-1 border-line border-b">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13.5px]",
              tab === t ? "border-bone font-medium" : "border-transparent text-bone-2 hover:text-bone",
            )}
          >
            {t}
            {t === "Ads" && d.counts.ads ? <span className="ml-1.5 text-bone-3">{d.counts.ads}</span> : null}
            {t === "Competitors" && d.counts.refs ? <span className="ml-1.5 text-bone-3">{d.counts.refs}</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-6 pb-16">
        {tab === "Ads" && <AdsBoard slug={slug} d={d} />}
        {tab === "Competitors" && <Competitors slug={slug} />}
        {tab === "Playbook" && <PlaybookView slug={slug} playbook={d.playbook} />}
        {tab === "Brand kit" && <Kit slug={slug} d={d} />}
        {tab === "Jobs" && <JobList brand={slug} />}
      </div>
    </div>
  );
}
