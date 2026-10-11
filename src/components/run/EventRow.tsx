import { TypedText } from "@/components/ui/TypedText";
import type { RunEvent } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { formatUsd, PHASE_LABELS } from "@/lib/client/format";

const GLYPH: Partial<Record<RunEvent["type"], string>> = {
  tool_call: "→",
  tool_result: "←",
  thinking: "∴",
  evidence: "◆",
  blueprint: "▤",
  review: "◎",
  question: "?",
  plan: "◉",
  concept: "✦",
  asset: "▣",
  compliance: "§",
  pack: "▢",
  cost: "$",
  warning: "!",
  error: "×",
  phase_started: "▸",
  phase_completed: "✓",
  status: "·",
  log: "·",
};

const TONE: Partial<Record<RunEvent["type"], string>> = {
  tool_call: "text-cyan",
  thinking: "text-[#a99bff]",
  evidence: "text-bone",
  warning: "text-warn",
  error: "text-fail",
  phase_started: "text-signal",
  phase_completed: "text-pass",
  question: "text-warn",
  blueprint: "text-signal",
  review: "text-signal",
};

/** One line of the live event stream. Tool calls type themselves in when `fresh`. */
export function EventRow({ e, t, fresh }: { e: RunEvent; t?: string; fresh?: boolean }) {
  const isPhase = e.type === "phase_started";
  return (
    <li
      data-type={e.type}
      className={cn(
        "grid grid-cols-[52px_16px_1fr_auto] items-baseline gap-2 px-3 py-[5px] font-mono text-[12px] leading-snug",
        fresh && "stream-in",
        isPhase && "mt-2 border-line border-t pt-3",
      )}
    >
      <span className="text-bone-4 tabular-nums">{t}</span>
      <span aria-hidden className={cn("text-center", TONE[e.type] ?? "text-bone-3")}>
        {GLYPH[e.type] ?? "·"}
      </span>
      <span
        className={cn("min-w-0", isPhase ? "text-bone" : e.type === "thinking" ? "text-bone-2 italic" : "text-bone-2")}
      >
        {isPhase && <span className="mr-2 text-signal uppercase tracking-[0.06em]">{PHASE_LABELS[e.phase]}</span>}
        {fresh && (e.type === "tool_call" || e.type === "thinking") ? (
          <TypedText text={e.title} cps={e.type === "thinking" ? 90 : 55} />
        ) : (
          e.title
        )}
        {e.detail && e.type !== "evidence" && (
          <span className="mt-0.5 block truncate text-[11px] text-bone-3 not-italic">{e.detail}</span>
        )}
      </span>
      <span className="text-[11px] text-bone-3 tabular-nums">{e.costUsd ? formatUsd(e.costUsd) : ""}</span>
    </li>
  );
}
