"use client";

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Phase, RunEvent, RunEventType, RunStatus } from "@/contracts";
import { getClient } from "./api";
import type { StreamState } from "./sse";

const c = () => getClient();

export const qk = {
  brands: ["brands"] as const,
  brand: (id: string) => ["brand", id] as const,
  connections: (id: string) => ["connections", id] as const,
  brandRuns: (id: string) => ["brandRuns", id] as const,
  results: (id: string) => ["results", id] as const,
  run: (id: string) => ["run", id] as const,
  evidence: (id: string) => ["evidence", id] as const,
  questions: (id: string) => ["questions", id] as const,
  plan: (id: string) => ["plan", id] as const,
  concepts: (id: string) => ["concepts", id] as const,
  blueprints: (id: string) => ["blueprints", id] as const,
  blueprint: (id: string) => ["blueprint", id] as const,
  packs: (id: string) => ["packs", id] as const,
  conceptAssets: (id: string) => ["conceptAssets", id] as const,
  conceptReviews: (id: string) => ["conceptReviews", id] as const,
  renders: (id: string) => ["renders", id] as const,
  variants: (id: string) => ["variants", id] as const,
  providers: ["providers"] as const,
  spend: ["spend"] as const,
};

export const useBrands = () => useQuery({ queryKey: qk.brands, queryFn: () => c().brands() });
export const useBrand = (id?: string) =>
  useQuery({ queryKey: qk.brand(id!), queryFn: () => c().brand(id!), enabled: !!id });
export const useConnections = (id?: string) =>
  useQuery({ queryKey: qk.connections(id!), queryFn: () => c().connections(id!), enabled: !!id });
export const useBrandRuns = (id?: string) =>
  useQuery({ queryKey: qk.brandRuns(id!), queryFn: () => c().brandRuns(id!), enabled: !!id });
export const useResults = (id?: string) =>
  useQuery({ queryKey: qk.results(id!), queryFn: () => c().results(id!), enabled: !!id });
export const useRun = (id: string) => useQuery({ queryKey: qk.run(id), queryFn: () => c().run(id) });
export const useEvidence = (id: string) => useQuery({ queryKey: qk.evidence(id), queryFn: () => c().evidence(id) });
export const useQuestions = (id: string) => useQuery({ queryKey: qk.questions(id), queryFn: () => c().questions(id) });
export const usePlan = (id: string) => useQuery({ queryKey: qk.plan(id), queryFn: () => c().plan(id), retry: false });
export const useConcepts = (id: string) => useQuery({ queryKey: qk.concepts(id), queryFn: () => c().concepts(id) });
export const useBlueprints = (id: string) =>
  useQuery({ queryKey: qk.blueprints(id), queryFn: () => c().blueprints(id) });
export const useBlueprint = (id: string) => useQuery({ queryKey: qk.blueprint(id), queryFn: () => c().blueprint(id) });
export const usePacks = (id: string) => useQuery({ queryKey: qk.packs(id), queryFn: () => c().packs(id) });
export const useConceptAssets = (id?: string) =>
  useQuery({ queryKey: qk.conceptAssets(id!), queryFn: () => c().conceptAssets(id!), enabled: !!id });
export const useConceptReviews = (id?: string) =>
  useQuery({ queryKey: qk.conceptReviews(id!), queryFn: () => c().conceptReviews(id!), enabled: !!id });
export const useRenders = (id?: string) =>
  useQuery({
    queryKey: qk.renders(id!),
    queryFn: () => c().renders(id!),
    enabled: !!id,
    // a version renders in about a minute and its review lands a few minutes later
    refetchInterval: (q) =>
      q.state.data?.some((v) => v.status === "rendering" || (v.status === "ready" && !v.review && v.message))
        ? 3000
        : false,
  });
export const useVariants = (id?: string) =>
  useQuery({ queryKey: qk.variants(id!), queryFn: () => c().variants(id!), enabled: !!id });
export const useProviders = () => useQuery({ queryKey: qk.providers, queryFn: () => c().providers() });
export const useSpend = () => useQuery({ queryKey: qk.spend, queryFn: () => c().spend() });

/** Mutation helper: run `fn`, then invalidate the listed keys. */
export function useAction<A, R>(
  fn: (a: A) => Promise<R>,
  invalidate: (a: A, r: R) => readonly (readonly unknown[])[] = () => [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => Promise.all(invalidate(a, r).map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

// Which cached lists an incoming event makes stale.
const STALE: Partial<Record<RunEventType, (id: string) => readonly unknown[]>> = {
  evidence: qk.evidence,
  question: qk.questions,
  plan: qk.plan,
  concept: qk.concepts,
  asset: qk.concepts,
  blueprint: qk.blueprints,
  pack: qk.packs,
  status: qk.run,
  phase_started: qk.run,
};

function debouncedInvalidate(qc: QueryClient) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key: readonly unknown[]) => {
    const k = JSON.stringify(key);
    if (timers.has(k)) return;
    timers.set(
      k,
      setTimeout(() => {
        timers.delete(k);
        qc.invalidateQueries({ queryKey: key });
      }, 250),
    );
  };
}

export type RunStream = {
  events: RunEvent[];
  status?: RunStatus;
  phase?: Phase;
  completed: Phase[];
  revealed: Set<string>;
  ended: boolean;
  connection: StreamState;
};

/** Subscribes to a run's event stream (mock or SSE) and derives live run state from it. */
export function useRunStream(runId: string, opts?: { pace?: number; epoch?: number }): RunStream {
  const qc = useQueryClient();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [ended, setEnded] = useState(false);
  const [connection, setConnection] = useState<StreamState>("connecting");
  const inval = useRef(debouncedInvalidate(qc));
  const pace = opts?.pace;
  const epoch = opts?.epoch ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: bumping epoch resubscribes from the start (replay)
  useEffect(() => {
    setEvents([]);
    setEnded(false);
    const buffer: RunEvent[] = [];
    let raf = 0;
    const flush = () => {
      raf = 0;
      const batch = buffer.splice(0);
      if (batch.length) setEvents((prev) => [...prev, ...batch]);
    };
    const stop = getClient().subscribeRun(
      runId,
      {
        onEvent: (e) => {
          buffer.push(e);
          raf ||= requestAnimationFrame(flush);
          const key = STALE[e.type]?.(runId);
          if (key) inval.current(key);
        },
        onEnd: () => {
          flush();
          setEnded(true);
          qc.invalidateQueries({ queryKey: qk.run(runId) });
        },
        onState: setConnection,
      },
      { pace },
    );
    return () => {
      cancelAnimationFrame(raf);
      stop();
    };
  }, [runId, pace, qc, epoch]);

  return useMemo(() => {
    let status: RunStatus | undefined;
    const completed: Phase[] = [];
    const revealed = new Set<string>();
    for (const e of events) {
      if (e.type === "status") status = (e.data as { status?: RunStatus })?.status ?? status;
      if (e.type === "phase_completed") completed.push(e.phase);
      if (e.refId) revealed.add(e.refId);
    }
    return { events, status, phase: events.at(-1)?.phase, completed, revealed, ended, connection };
  }, [events, ended, connection]);
}
