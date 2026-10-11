import type { Phase, RunStatus } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { PHASE_LABELS } from "@/lib/client/format";

export type PhaseState = "done" | "active" | "waiting" | "failed" | "pending";

/** Derives every phase's state from the run's current phase/status plus phases the stream reported complete. */
export function phaseStates(
  phases: readonly Phase[],
  current: Phase,
  status: RunStatus,
  completed: readonly Phase[] = [],
) {
  const idx = phases.indexOf(current);
  return phases.map((p, i): PhaseState => {
    if (completed.includes(p) && p !== current) return "done";
    if (i < idx) return "done";
    if (i > idx) return "pending";
    if (status === "done") return "done";
    if (status === "failed" || status === "cancelled") return "failed";
    if (status === "waiting_input") return "waiting";
    if (status === "queued") return "pending";
    return "active";
  });
}

const NODE: Record<PhaseState, string> = {
  done: "bg-bone",
  active: "bg-signal",
  waiting: "bg-warn",
  failed: "bg-fail",
  pending: "bg-ink shadow-[inset_0_0_0_1.5px_var(--color-bone-4)]",
};
const TEXT: Record<PhaseState, string> = {
  done: "text-bone-2",
  active: "text-bone",
  waiting: "text-warn",
  failed: "text-fail",
  pending: "text-bone-4",
};
const NOTE: Record<PhaseState, string> = {
  done: "done",
  active: "working",
  waiting: "needs you",
  failed: "stopped",
  pending: "",
};

/** Vertical phase rail with a light that travels down to the active phase. */
export function PhaseRail({
  phases,
  current,
  status,
  completed,
  notes,
  orientation = "vertical",
  className,
}: {
  phases: readonly Phase[];
  current: Phase;
  status: RunStatus;
  completed?: readonly Phase[];
  notes?: Partial<Record<Phase, string>>;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const states = phaseStates(phases, current, status, completed);
  const reached = Math.max(
    0,
    states.lastIndexOf("done"),
    states.findIndex((s) => s !== "done" && s !== "pending"),
  );
  const progress = phases.length > 1 ? reached / (phases.length - 1) : 0;

  if (orientation === "horizontal") {
    return (
      <ol className={cn("flex gap-1 overflow-x-auto pb-1", className)} aria-label="Run phases">
        {phases.map((p, i) => (
          <li
            key={p}
            data-state={states[i]}
            aria-current={states[i] === "active" || states[i] === "waiting" ? "step" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-chip px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em]",
              TEXT[states[i]],
              states[i] !== "pending" && "bg-glass",
            )}
          >
            <span className={cn("size-1.5 rounded-full", NODE[states[i]])} />
            {PHASE_LABELS[p]}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      className={cn("relative flex flex-col", className)}
      aria-label="Run phases"
      style={{ "--p": progress } as React.CSSProperties}
    >
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />
      <span
        aria-hidden
        className="absolute top-2 left-[5px] w-px bg-bone transition-[height] duration-700 ease-out"
        style={{ height: `calc((100% - 16px) * ${progress})` }}
      />
      {phases.map((p, i) => (
        <li
          key={p}
          data-state={states[i]}
          aria-current={states[i] === "active" || states[i] === "waiting" ? "step" : undefined}
          className="relative flex min-h-11 items-center gap-4"
        >
          <span
            className={cn(
              "relative z-10 size-[11px] shrink-0 rounded-full transition-all duration-500",
              NODE[states[i]],
            )}
          />
          <span
            className={cn(
              "flex min-w-0 flex-1 items-baseline justify-between gap-3 text-ui transition-colors duration-500",
              TEXT[states[i]],
            )}
          >
            <span className={cn(states[i] === "active" && "font-medium")}>{PHASE_LABELS[p]}</span>
            <span className="truncate font-mono text-[10.5px] text-bone-3">{notes?.[p] ?? NOTE[states[i]]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
