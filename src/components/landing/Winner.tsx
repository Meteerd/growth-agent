import { PURPOSE_COLOR } from "@/lib/client/purpose";
import type { proofFor } from "./data";

type Proof = NonNullable<ReturnType<typeof proofFor>>;

/** The winning ad as its blueprint: who made it, its real numbers, its beats on the time axis, a link to the original. */
export function WinnerCard({ p, compact }: { p: Proof; compact?: boolean }) {
  const w = p.winner;
  const total = w.duration;
  const stats: [string, string][] = [
    ...(w.views != null ? [["views", w.views.toLocaleString("en-US")] as [string, string]] : []),
    ...(w.outlier != null ? [["vs account median", `${w.outlier}x`] as [string, string]] : []),
    ...(w.daysRunning != null ? [["running", `${w.daysRunning} days`] as [string, string]] : []),
    ["length", `${Math.round(total)}s`],
  ];
  return (
    <div className="flex h-full flex-col bg-[#111] p-6 text-white md:p-8">
      <p className="text-[13px] text-white/60">The winner, taken apart</p>
      <p className="mt-1 font-semibold text-[20px] tracking-[-0.02em]">
        {w.source} {w.kind}
        {w.author ? ` by ${w.author}` : ""}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-white/15 border-y py-4 font-mono text-[13px] sm:grid-cols-3">
        {stats.slice(0, 3).map(([k, v]) => (
          <div key={k}>
            <dt className="text-white/50">{k}</dt>
            <dd className="mt-1 text-[19px]">{v}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-5 flex flex-1 flex-col gap-2.5">
        {p.beats.map((b) => (
          <li key={b.t0} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 text-[13.5px] leading-snug">
            <span className="flex items-start gap-2 pt-0.5 font-mono text-[12px] text-white/55">
              <span className="mt-1 size-2 shrink-0 rounded-[2px]" style={{ background: PURPOSE_COLOR[b.purpose] }} />
              {Math.round(b.t0)}s
            </span>
            <span className={compact ? "line-clamp-2" : undefined}>
              <span className="font-semibold">{b.label}.</span> <span className="text-white/75">{b.what}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        {p.beats.map((b) => (
          <span
            key={b.t0}
            style={{ width: `${((b.t1 - b.t0) / total) * 100}%`, background: PURPOSE_COLOR[b.purpose] }}
          />
        ))}
      </div>
      {w.url && (
        <a
          href={w.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 text-[13px] text-white/70 underline underline-offset-4"
        >
          See the original on {w.source}
        </a>
      )}
    </div>
  );
}
