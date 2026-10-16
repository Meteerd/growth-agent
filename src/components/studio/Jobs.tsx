"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/client/cn";
import { ago, api, type Job, usd, useJobs } from "@/lib/client/studio";

const KIND: Record<string, string> = {
  setup: "Brand setup",
  scan: "Competitor scan",
  analyze: "Teardown and playbook",
  generate: "Generate ads",
  revise: "Revise an ad",
  autopilot: "Autopilot",
};

function JobRow({ j }: { j: Job }) {
  const [open, setOpen] = useState(false);
  const live = j.status === "running" || j.status === "queued";
  return (
    <div className="border-line border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[#FAF9F6]"
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            live
              ? "animate-pulse bg-signal"
              : j.status === "done"
                ? "bg-pass"
                : j.status === "failed"
                  ? "bg-fail"
                  : "bg-bone-4",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="font-medium">{KIND[j.kind] ?? j.kind}</span>
            {typeof j.input.brand === "string" && <span className="text-bone-3">{j.input.brand}</span>}
            {typeof j.input.url === "string" && <span className="text-bone-3">{j.input.url}</span>}
          </div>
          <div className="truncate text-[12.5px] text-bone-2">{j.status === "failed" ? j.error : j.step}</div>
        </div>
        {live && (
          <div className="hidden w-32 sm:block">
            <div className="h-1 overflow-hidden rounded bg-line">
              <div className="h-full bg-signal transition-all" style={{ width: `${Math.round(j.progress * 100)}%` }} />
            </div>
          </div>
        )}
        <span className="w-16 text-right font-mono text-[12px] text-bone-3">{usd(j.costUsd)}</span>
        <span className="hidden w-20 text-right text-[12px] text-bone-3 sm:block">{ago(j.createdAt)}</span>
      </button>
      {open && (
        <div className="space-y-2 bg-[#FAF9F6] px-4 py-3">
          <div className="max-h-64 overflow-y-auto font-mono text-[11.5px] text-bone-2">
            {j.log.map((l, i) => (
              <div key={i}>
                <span className="text-bone-3">{l.ts.slice(11, 19)}</span> {l.msg}
              </div>
            ))}
          </div>
          {live && (
            <button type="button" onClick={() => api.post(`/jobs/${j.id}/cancel`)} className="text-[12px] text-fail">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function JobList({ brand, limit }: { brand?: string; limit?: number }) {
  const jobs = useJobs(brand);
  const list = (jobs.data ?? []).slice(0, limit ?? 50);
  if (!list.length)
    return <div className="rounded-xl border border-line bg-white px-4 py-6 text-[13px] text-bone-3">No jobs yet.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {list.map((j) => (
        <JobRow key={j.id} j={j} />
      ))}
    </div>
  );
}

export function JobsPage() {
  const spend = useQuery({
    queryKey: ["studio", "spend"],
    queryFn: () =>
      api.get<{
        spent: Record<string, number>;
        caps: Record<string, number | null>;
        recent: { provider: string; usd: number; note: string; ts: string }[];
      }>("/spend"),
    refetchInterval: 10000,
  });
  const total = Object.values(spend.data?.spent ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="font-semibold text-[28px] tracking-tight">Jobs and spend</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[12px] text-bone-3">Total spent</div>
          <div className="mt-1 font-semibold text-[22px]">{usd(total)}</div>
        </div>
        {Object.entries(spend.data?.caps ?? {}).map(([p, cap]) => (
          <div key={p} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[12px] text-bone-3 capitalize">{p}</div>
            <div className="mt-1 font-semibold text-[18px]">{usd(spend.data?.spent[p] ?? 0)}</div>
            {cap ? <div className="text-[11.5px] text-bone-3">cap {usd(cap)}</div> : null}
          </div>
        ))}
      </div>
      <div className="mt-8">
        <JobList />
      </div>
    </div>
  );
}
