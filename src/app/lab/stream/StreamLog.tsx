"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PhaseRail } from "@/components/ui/PhaseRail";
import { DEMO_RUNS, PHASES, type RunEvent } from "@/contracts";
import { clock } from "@/lib/client/format";
import { createMockClient } from "@/lib/client/mock/client";

const client = createMockClient();

export function StreamLog() {
  const [slug, setSlug] = useState("hound");
  const [runId, setRunId] = useState<string>();
  const [events, setEvents] = useState<(RunEvent & { at: number })[]>([]);
  const [ended, setEnded] = useState<string>();
  const t0 = useRef(0);
  const last = events.at(-1);
  const waiting = last?.type === "status" && (last.data as { status?: string })?.status === "waiting_input";

  useEffect(() => {
    if (!runId) return;
    t0.current = performance.now();
    return client.subscribeRun(runId, {
      onEvent: (e) => {
        console.log(`[mock] ${e.id} ${e.phase} ${e.type} ${e.title}`);
        setEvents((p) => [...p, { ...e, at: performance.now() - t0.current }]);
      },
      onEnd: (d) => setEnded(d.status),
    });
  }, [runId]);

  const start = async () => {
    setEvents([]);
    setEnded(undefined);
    setRunId((await client.startRun(slug)).id);
  };
  const answerDefaults = async () => {
    if (!runId) return;
    const qs = await client.questions(runId);
    await client.answer(runId, {
      answers: qs.map((q) => ({ questionId: q.id, value: q.defaultAnswer, skip: q.defaultAnswer == null })),
    });
  };

  return (
    <div className="mt-10 grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(DEMO_RUNS).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === slug ? "primary" : "ghost"}
              magnetic={false}
              onClick={() => setSlug(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <Button variant="primary" onClick={start} data-testid="stream-start">
          Play mock run
        </Button>
        {waiting && (
          <Button onClick={answerDefaults} data-testid="stream-answer">
            Answer with defaults
          </Button>
        )}
        <div className="glass-flat p-4">
          <PhaseRail
            phases={PHASES.filter((p) => p !== "measure")}
            current={last?.phase ?? "intake"}
            status={ended ? "done" : waiting ? "waiting_input" : runId ? "running" : "queued"}
          />
        </div>
        <p className="font-mono text-[11px] text-bone-3" data-testid="stream-count">
          {events.length} events{ended ? `, ended: ${ended}` : ""}
        </p>
        <DemoBadge />
      </aside>
      <ol className="glass-flat h-[70vh] overflow-y-auto p-2 font-mono text-[12px]">
        {events.length === 0 && (
          <li className="p-4 text-bone-3">Press play. Events appear here as the script emits them.</li>
        )}
        {events.map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[64px_36px_120px_1fr] items-baseline gap-3 rounded-[6px] px-3 py-1.5 hover:bg-glass"
          >
            <span className="text-bone-3">{clock(e.at).slice(0, 8)}</span>
            <span className="text-bone-3">{e.id}</span>
            <span className="truncate text-bone-2">{e.type}</span>
            <span className="truncate text-bone">
              {e.title}
              {e.costUsd ? <Badge className="ml-2 h-5">{`$${e.costUsd}`}</Badge> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
