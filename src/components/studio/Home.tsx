"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { api, useBrands, useRefresh } from "@/lib/client/studio";
import { JobList } from "./Jobs";

export function NewBrand({ onDone }: { onDone?: () => void }) {
  const [url, setUrl] = useState("");
  const [countries, setCountries] = useState("");
  const [languages, setLanguages] = useState("");
  const [notes, setNotes] = useState("");
  const [autopilot, setAutopilot] = useState(true);
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const router = useRouter();
  const split = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      await api.post("/brands", {
        url,
        countries: split(countries).map((c) => c.toUpperCase()),
        languages: split(languages).map((l) => l.toLowerCase()),
        notes: notes.trim() ? [notes.trim()] : undefined,
        autopilot,
      });
      toast({
        title: autopilot ? "Autopilot started" : "Setup started",
        body: "Follow it under Jobs. A full autopilot run takes 15 to 30 minutes.",
      });
      setUrl("");
      refresh();
      onDone?.();
      router.push("/studio/jobs");
    } catch (err) {
      toast({ title: "Could not start", body: err instanceof Error ? err.message : String(err), tone: "fail" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-white p-5">
      <div className="font-medium text-[15px]">Add a brand</div>
      <p className="mt-1 text-[13px] text-bone-2">
        Paste the website. The studio reads it, builds the brand kit, finds the competitors that advertise in your
        markets, takes their winning ads apart and makes the first ads.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://a.clinic"
          className="rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong"
        />
        <input
          value={countries}
          onChange={(e) => setCountries(e.target.value)}
          placeholder="Markets: SK, CZ"
          className="rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong"
        />
        <input
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          placeholder="Languages: sk, cs"
          className="rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Anything the ads must know (offer, who can appear, what never to say)"
        className="mt-3 w-full resize-none rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-bone-2">
          <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
          Autopilot: scan competitors, write the playbook and make 6 ads
        </label>
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-md bg-bone px-4 py-2 text-[13.5px] text-white disabled:opacity-40"
        >
          {busy ? "Starting..." : autopilot ? "Set up and make ads" : "Set up"}
        </button>
      </div>
    </form>
  );
}

export function StudioHome() {
  const brands = useBrands();
  const params = useSearchParams();
  const [showNew, setShowNew] = useState(params.get("new") === "1");
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[28px] tracking-tight">Studio</h1>
          <p className="mt-1 text-[14px] text-bone-2">
            Statics and carousels rebuilt from what already wins in each market.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="rounded-md bg-bone px-4 py-2 text-[13.5px] text-white"
        >
          {showNew ? "Close" : "Add a brand"}
        </button>
      </div>
      {showNew && (
        <div className="mt-6">
          <NewBrand onDone={() => setShowNew(false)} />
        </div>
      )}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(brands.data ?? []).map((b) => (
          <Link
            key={b.slug}
            href={`/studio/${b.slug}`}
            className="group overflow-hidden rounded-xl border border-line bg-white hover:border-line-strong"
          >
            <div className="relative aspect-[4/3] overflow-hidden" style={{ background: b.colors.paper }}>
              {b.cover ? (
                // biome-ignore lint/performance/noImgElement: generated ad thumbnails
                <img
                  src={b.cover}
                  alt=""
                  className="absolute inset-0 size-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  {b.logo ? (
                    // biome-ignore lint/performance/noImgElement: logo
                    <img src={b.logo} alt="" className="size-20 object-contain" />
                  ) : (
                    <span className="font-semibold text-[28px]" style={{ color: b.colors.ink }}>
                      {b.name}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[15px]">{b.name}</span>
                <span className="text-[12px] text-bone-3">{b.countries.join(" ")}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] text-bone-2">{b.oneLiner}</p>
              <div className="mt-3 flex gap-4 text-[12px] text-bone-3">
                <span>{b.counts.ads} ads</span>
                <span>{b.counts.approved} approved</span>
                <span>{b.counts.refs} competitor ads</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-10">
        <h2 className="font-medium text-[15px]">Recent jobs</h2>
        <div className="mt-3">
          <JobList limit={6} />
        </div>
      </div>
    </div>
  );
}
