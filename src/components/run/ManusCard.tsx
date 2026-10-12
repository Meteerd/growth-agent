"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import type { Evidence } from "@/contracts";
import MANUS from "@/lib/client/manus-tasks.json";
import { useEvidence } from "@/lib/client/queries";
import { landscapeLead, manusRows } from "./manus";
import { useRunCtx } from "./RunContext";

const byTag = (items: Evidence[], tag: string) => items.find((e) => e.tags?.includes(tag));

type Recorded = {
  taskUrl: string;
  state: string;
  summary?: string;
  competitors?: { name: string; note: string }[];
  communities?: { name: string; note: string }[];
};
const research = (brandId?: string) =>
  (MANUS.research as Record<string, Recorded>)[brandId?.replace(/^brand_/, "") ?? ""];

/** Manus deep research: landscape, competitors and community rules, each fact sourced, with a link to the real task. */
export function ManusCard() {
  const { run, events, revealed, runId, liveStatus } = useRunCtx();
  const { data: evidence } = useEvidence(runId);
  const finished = liveStatus === "done" || liveStatus === "failed";
  const items = (evidence ?? []).filter(
    (e) => e.source === "manus_research" && !e.demo && (finished || revealed.has(e.id)),
  );
  const calls = events.filter((e) => (e.data as { provider?: string } | undefined)?.provider === "manus");
  // brands whose recorded research ran without Manus got a separate real Manus task on 12 Oct (demo/manus.ts)
  const extra = finished && !items.length ? research(run?.brandId) : undefined;
  if (!items.length && !calls.length && !run?.manusTaskUrl && !extra) return null;
  const done = extra ? extra.state === "done" : items.length > 0 || calls.some((e) => e.type === "tool_result");
  const url = extra?.taskUrl ?? run?.manusTaskUrl ?? items.find((e) => e.url)?.url;
  const landscape = extra ? landscapeLead(extra.summary) : landscapeLead(byTag(items, "landscape")?.text);
  const competitors = extra?.competitors ?? manusRows(byTag(items, "competitors")?.text);
  const communities = extra?.communities ?? manusRows(byTag(items, "communities")?.text);
  const summary = [
    landscape && "the channels buyers use",
    competitors.length && `${competitors.length} competitors`,
    communities.length && `the self-promotion rules of ${communities.length} communities`,
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-flat overflow-hidden"
      data-testid="manus-card"
    >
      <div className="flex flex-wrap items-center gap-4 p-4">
        <span className="grid size-9 place-items-center rounded-[4px] bg-bone font-display text-[17px] text-ink">
          M
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-label">Manus / deep research task</p>
          <p className="mt-0.5 text-bone text-ui">
            {!done
              ? "Manus is mapping the market for this brand, in parallel with the other sources."
              : summary.length
                ? `Manus mapped ${summary.join(", ").replace(/, ([^,]*)$/, " and $1")}. Every fact has a source.`
                : "Manus mapped the market. Its findings are on the wall with their sources."}
          </p>
        </div>
        <Badge tone={done ? "pass" : "signal"} dot>
          {done ? "done" : "running"}
        </Badge>
        {url && /^https?:\/\//.test(url) && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] text-bone underline decoration-bone-4 underline-offset-4"
            data-testid="manus-link"
          >
            Open the Manus task
          </a>
        )}
      </div>
      {done && (landscape || competitors.length > 0 || communities.length > 0) && (
        <dl className="border-line border-t text-[13px] leading-snug" data-testid="manus-findings">
          {landscape && (
            <Finding label="Landscape">
              <p className="text-bone-2">{landscape}</p>
            </Finding>
          )}
          {competitors.length > 0 && (
            <Finding label="Competitors" count={competitors.length}>
              <p className="text-bone-2">
                {competitors.map((c, i) => (
                  <span key={c.name}>
                    <span className="font-medium text-bone" title={c.note}>
                      {c.name}
                    </span>
                    {i < competitors.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-bone-3">
                {competitors[0].name}: {competitors[0].note}
              </p>
            </Finding>
          )}
          {communities.length > 0 && (
            <Finding label="Community rules" count={communities.length}>
              <ul className="grid-cols-1 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
                {communities.map((c) => (
                  <li key={c.name} className="line-clamp-2">
                    <span className="font-medium text-bone">{c.name}</span>{" "}
                    <span className="text-bone-2">{c.note}</span>
                  </li>
                ))}
              </ul>
            </Finding>
          )}
        </dl>
      )}
    </motion.div>
  );
}

function Finding({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="grid-cols-1 grid gap-1 border-line border-t px-4 py-3 first:border-t-0 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
      <dt className="mono-label pt-px">
        {label} {count != null && <span className="font-mono text-bone-3">{count}</span>}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
