"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Phase, Run, RunStatus } from "@/contracts";
import { type RunStream, useRun, useRunStream } from "@/lib/client/queries";

type RunCtx = RunStream & {
  runId: string;
  run?: Run;
  /** Stream status wins over the fetched run (it is newer); the fetched run covers the gap before the first event. */
  liveStatus: RunStatus;
  livePhase: Phase;
  replay: (pace?: number) => void;
  pace?: number;
};

const Ctx = createContext<RunCtx | null>(null);

/** One stream subscription per run, shared by every run screen (cockpit, consult, direction, studio, packs). */
export function RunProvider({ runId, children }: { runId: string; children: React.ReactNode }) {
  const [pace, setPace] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const p = Number(new URLSearchParams(window.location.search).get("pace"));
    return p > 0 ? Math.min(p, 5000) : undefined;
  });
  const [epoch, setEpoch] = useState(0);
  const { data: run } = useRun(runId);
  const stream = useRunStream(runId, { pace, epoch });
  const value = useMemo<RunCtx>(
    () => ({
      ...stream,
      runId,
      run,
      liveStatus: stream.status ?? run?.status ?? "queued",
      livePhase: stream.phase ?? run?.phase ?? "intake",
      pace,
      replay: (p = 250) => {
        setPace(p);
        setEpoch((e) => e + 1);
      },
    }),
    [stream, runId, run, pace],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRunCtx outside RunProvider");
  return v;
}
