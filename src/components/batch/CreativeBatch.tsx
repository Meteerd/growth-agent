"use client";

import { useQuery } from "@tanstack/react-query";
import { strToU8, zipSync } from "fflate";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/client/cn";

// Camplan's creative batch (Mete, 12:00): every variant Lane A made, filterable, approved or rejected by a human, and
// the approved ones downloaded as a zip with manifest.csv for a real Meta test campaign. Reads
// GET /api/brands/:id/creatives (agreed in INBOX_A); renders nothing for a brand without a batch.

export type Creative = {
  id: string;
  name: string;
  format: string;
  hook?: string;
  emotion?: string;
  persona?: string;
  language?: string;
  review?: number;
  url: string;
  posterUrl?: string;
  slides?: string[];
  feature?: string;
  setting?: string;
  /** ids or names of creatives the similarity gate found too close to this one (Meta would group them) */
  similarTo?: string[];
};
type Verdict = "approved" | "rejected";
const FACETS = ["format", "hook", "emotion", "persona", "language"] as const;
type Facet = (typeof FACETS)[number];

const key = (brandId: string) => `nexus-batch-${brandId}`;
const fileName = (c: Creative, url: string, i?: number) =>
  `${c.name}${i != null ? `_slide${i + 1}` : ""}${url.match(/\.[a-z0-9]{2,4}(?=$|\?)/i)?.[0] ?? ""}`;
const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/** manifest.csv for the Meta test: one row per approved creative and file. */
export function manifestCsv(rows: { c: Creative; file: string }[]) {
  const head = ["name", "format", "hook", "emotion", "persona", "language", "review", "file"];
  const lines = rows.map(({ c, file }) =>
    [c.name, c.format, c.hook, c.emotion, c.persona, c.language, c.review, file].map(csvCell).join(","),
  );
  return `${[head.join(","), ...lines].join("\n")}\n`;
}

export function CreativeBatch({ brandId, enabled = true }: { brandId: string; enabled?: boolean }) {
  const { data } = useQuery({
    queryKey: ["creatives", brandId],
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/creatives`, { headers: { accept: "application/json" } });
      if (!res.ok) return [] as Creative[];
      const body = await res.json().catch(() => []);
      return (Array.isArray(body) ? body : (body?.creatives ?? body?.items ?? [])) as Creative[];
    },
    retry: false,
    enabled,
  });
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [filters, setFilters] = useState<Partial<Record<Facet, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setVerdicts(JSON.parse(localStorage.getItem(key(brandId)) ?? "{}"));
    } catch {}
  }, [brandId]);
  const judge = (id: string, v: Verdict) =>
    setVerdicts((cur) => {
      const next = { ...cur, [id]: cur[id] === v ? undefined : v } as Record<string, Verdict>;
      try {
        localStorage.setItem(key(brandId), JSON.stringify(next));
      } catch {}
      return next;
    });

  const items = data ?? [];
  const values = useMemo(
    () =>
      Object.fromEntries(
        FACETS.map((f) => [f, [...new Set(items.map((c) => c[f]).filter((x): x is string => !!x))].sort()]),
      ) as Record<Facet, string[]>,
    [items],
  );
  if (!items.length) return null;
  const shown = items.filter((c) => FACETS.every((f) => !filters[f] || c[f] === filters[f]));
  const approved = items.filter((c) => verdicts[c.id] === "approved");

  const download = async () => {
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {};
      const rows: { c: Creative; file: string }[] = [];
      for (const c of approved) {
        const urls = c.slides?.length ? c.slides : [c.url];
        for (const [i, u] of urls.entries()) {
          const res = await fetch(u);
          if (!res.ok) throw new Error(`${c.name}: ${res.status}`);
          const file = fileName(c, u, c.slides?.length ? i : undefined);
          files[file] = new Uint8Array(await res.arrayBuffer());
          rows.push({ c, file });
        }
      }
      files["manifest.csv"] = strToU8(manifestCsv(rows));
      // media is already compressed: store it, so the zip is instant
      const zip = zipSync(files, { level: 0 });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      a.download = `meta-test-${brandId.replace(/^brand_/, "")}-${approved.length}-creatives.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast({ title: "The download did not finish", body: e instanceof Error ? e.message : undefined, tone: "fail" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Creative batch"
      data-testid="creative-batch"
      className="glass-flat flex flex-col gap-5 p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mono-label">Creative batch</p>
          <p className="mt-1 text-[14px] text-bone-2">
            {items.length} creatives, {approved.length} approved,{" "}
            {items.filter((c) => verdicts[c.id] === "rejected").length} rejected
          </p>
        </div>
        <button
          type="button"
          disabled={!approved.length || busy}
          onClick={download}
          data-testid="batch-download"
          className="rounded-chip bg-[#2b2620] px-4 py-2 font-medium text-[13px] text-white hover:bg-[#3d3730] disabled:opacity-40"
        >
          {busy ? "Packing" : `Download approved for Meta test (${approved.length})`}
        </button>
      </div>

      <Diversity items={items} onCell={(persona, format) => setFilters((cur) => ({ ...cur, persona, format }))} />

      <div className="flex flex-col gap-2">
        {FACETS.filter((f) => values[f].length > 1).map((f) => (
          <div key={f} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-[12px] text-bone-3 capitalize">{f}</span>
            {values[f].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={filters[f] === v}
                onClick={() => setFilters((cur) => ({ ...cur, [f]: cur[f] === v ? undefined : v }))}
                className={cn(
                  "rounded-chip px-2.5 py-1 text-[12px] transition-colors duration-150",
                  filters[f] === v ? "bg-bone text-ink" : "bg-raised-2 text-bone-2 hover:text-bone",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="batch-grid">
        {shown.map((c) => {
          const v = verdicts[c.id];
          const media = c.slides?.[0] ?? c.posterUrl;
          return (
            <li
              key={c.id}
              data-testid="batch-item"
              className={cn(
                "flex flex-col overflow-hidden rounded-card bg-ink",
                v === "approved" && "ring-2 ring-pass",
                v === "rejected" && "opacity-55",
              )}
            >
              <div className="aspect-[4/5] overflow-hidden bg-viewer">
                {/\.(mp4|webm|mov)(\?|$)/i.test(c.url) ? (
                  <video
                    src={c.url}
                    poster={c.posterUrl}
                    muted
                    loop
                    playsInline
                    preload="none"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // biome-ignore lint/performance/noImgElement: local creative files
                  <img src={media ?? c.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="break-all font-mono text-[11px] text-bone">{c.name}</p>
                {!!c.similarTo?.length && (
                  <span
                    className="self-start rounded-chip bg-warn px-1.5 py-0.5 font-medium text-[11px] text-white"
                    title={`Too close to ${c.similarTo.join(", ")}: Meta would group them as one`}
                  >
                    too similar
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                  {FACETS.map((f) =>
                    c[f] ? (
                      <span key={f} className="rounded-chip bg-raised px-1.5 py-0.5 text-[11px] text-bone-2">
                        {c[f]}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  {c.review != null && (
                    <span className="mr-auto font-mono text-[12px] text-bone-2">{c.review}/100</span>
                  )}
                  <button
                    type="button"
                    aria-pressed={v === "approved"}
                    onClick={() => judge(c.id, "approved")}
                    className={cn(
                      "ml-auto rounded-chip px-2 py-1 text-[12px]",
                      v === "approved" ? "bg-pass text-white" : "bg-raised text-bone-2 hover:text-bone",
                    )}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    aria-pressed={v === "rejected"}
                    onClick={() => judge(c.id, "rejected")}
                    className={cn(
                      "rounded-chip px-2 py-1 text-[12px]",
                      v === "rejected" ? "bg-fail text-white" : "bg-raised text-bone-2 hover:text-bone",
                    )}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Why the batch is built for Meta: which persona x format cells are covered, and how hooks and features spread.
 * Meta groups lookalike creatives, so empty cells and "too similar" pairs matter more than the count. */
function Diversity({ items, onCell }: { items: Creative[]; onCell: (persona?: string, format?: string) => void }) {
  const personas = [...new Set(items.map((c) => c.persona ?? "no persona"))].sort();
  const formats = [...new Set(items.map((c) => c.format))].sort();
  const count = (p: string, f: string) =>
    items.filter((c) => (c.persona ?? "no persona") === p && c.format === f).length;
  const spread = (k: "hook" | "feature") =>
    Object.entries(
      items.reduce<Record<string, number>>((m, c) => {
        if (c[k]) m[c[k]!] = (m[c[k]!] ?? 0) + 1;
        return m;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const similar = items.filter((c) => c.similarTo?.length).length;
  const covered = personas.flatMap((p) => formats.filter((f) => count(p, f))).length;
  return (
    <div
      className="grid-cols-1 grid gap-4 rounded-card bg-ink p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      data-testid="diversity"
    >
      <div className="min-w-0">
        <p className="font-semibold text-[13px] text-bone">
          Coverage: {covered} of {personas.length * formats.length} persona x format cells
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-[12px]">
            <thead>
              <tr>
                <th />
                {formats.map((f) => (
                  <th key={f} className="px-1 text-left font-normal text-bone-3">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p}>
                  <th className="pr-2 text-left font-normal text-bone-2">{p}</th>
                  {formats.map((f) => {
                    const n = count(p, f);
                    return (
                      <td key={f}>
                        <button
                          type="button"
                          disabled={!n}
                          onClick={() => onCell(p === "no persona" ? undefined : p, f)}
                          className={cn(
                            "h-8 w-full min-w-10 rounded-[6px] font-mono text-[12px]",
                            n ? "bg-[#2b2620] text-white hover:bg-[#3d3730]" : "bg-raised-2 text-bone-4",
                          )}
                        >
                          {n || "-"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 text-[12px]">
        {(["hook", "feature"] as const).map((k) => {
          const rows = spread(k);
          return rows.length ? (
            <div key={k}>
              <p className="font-semibold text-[13px] text-bone">
                {rows.length} {k === "hook" ? "hooks" : "features"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rows.map(([v, n]) => (
                  <span key={v} className="rounded-chip bg-raised px-1.5 py-0.5 text-bone-2">
                    {v} <span className="font-mono text-bone-3">{n}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null;
        })}
        <p className={cn("font-medium text-[13px]", similar ? "text-warn" : "text-pass")}>
          {similar ? `${similar} ${similar === 1 ? "creative" : "creatives"} flagged too similar` : "No pair flagged too similar"}
        </p>
      </div>
    </div>
  );
}
