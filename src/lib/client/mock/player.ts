import type { RunEvent, RunEventType } from "@/contracts";

// Relative screen time per event type: tool calls type themselves in, evidence lands fast, thinking breathes.
const WEIGHT: Partial<Record<RunEventType, number>> = {
  phase_started: 1.6,
  phase_completed: 1.1,
  thinking: 2.2,
  tool_call: 1.8,
  tool_result: 1,
  evidence: 0.45,
  blueprint: 2.4,
  review: 2.2,
  question: 0.35,
  plan: 2,
  concept: 1.3,
  asset: 0.8,
  compliance: 1,
  pack: 0.8,
  cost: 0.3,
  status: 0.5,
  log: 0.5,
};

/** Delay (ms) before each event so the whole run plays in about `totalMs`, excluding the consult pause. */
export function eventDelays(events: readonly RunEvent[], totalMs = 60_000) {
  const w = events.map((e) => WEIGHT[e.type] ?? 0.8);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => Math.round((x / sum) * totalMs));
}

export const isPause = (e: RunEvent) =>
  e.type === "status" && (e.data as { status?: string } | undefined)?.status === "waiting_input";

/**
 * Plays a recorded event log on timers. Stops after a `status: waiting_input` event until `resume()`.
 * `index` is the next event to emit, so a player can be restored mid-run.
 */
export function createPlayer(
  events: readonly RunEvent[],
  opts: { totalMs?: number; startIndex?: number; onEvent: (e: RunEvent, index: number) => void; onDone?: () => void },
) {
  const delays = eventDelays(events, opts.totalMs);
  let index = opts.startIndex ?? 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  let stopped = false;

  const step = () => {
    if (stopped || paused) return;
    if (index >= events.length) {
      opts.onDone?.();
      return;
    }
    timer = setTimeout(() => {
      const e = events[index];
      opts.onEvent(e, index);
      index++;
      if (isPause(e)) paused = true;
      step();
    }, delays[index]);
  };

  return {
    start: step,
    resume() {
      if (!paused) return;
      paused = false;
      step();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    get index() {
      return index;
    },
    get paused() {
      return paused;
    },
  };
}
