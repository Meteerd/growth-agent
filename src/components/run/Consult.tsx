"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/Chip";
import { EvidenceCard, sourceHue } from "@/components/ui/EvidenceCard";
import { Sheet } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import type { Evidence, Question } from "@/contracts";
import { ApiRequestError, getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { formatCount, SOURCE_LABELS } from "@/lib/client/format";
import { qk, useEvidence, useQuestions } from "@/lib/client/queries";
import { useRunCtx } from "./RunContext";

const answered = (q: Question) => !!q.answeredAt || q.answer !== undefined || !!q.skipped;

/** Human-readable form of an answer value, for summaries and assumptions. */
export function describeAnswer(q: Question, v: unknown): string {
  if (v === undefined || v === null) return "";
  if (q.kind === "confirm") return v ? "Yes" : "No";
  if (q.kind === "scale") return q.scale && q.scale.max >= 100 ? `$${formatCount(Number(v))}` : String(v);
  const label = (id: unknown) => q.options?.find((o) => o.id === id)?.label ?? String(id);
  if (Array.isArray(v)) return v.map(label).join(", ");
  return q.kind === "single" ? label(v) : String(v);
}

type Local = Record<string, { value?: unknown; skipped?: boolean }>;

/** What the operator said, or that they skipped, for the step list and the summary. */
function outcome(q: Question, local: Local) {
  const l = local[q.id];
  const skipped = !!(l?.skipped ?? q.skipped);
  return { skipped, text: skipped ? "" : describeAnswer(q, l ? l.value : q.answer) };
}

export function Consult() {
  const { runId, revealed, liveStatus } = useRunCtx();
  const { data, isLoading } = useQuestions(runId);
  const qc = useQueryClient();
  const router = useRouter();
  const questions = useMemo(
    () => (data ?? []).filter((q) => revealed.has(q.id)).sort((a, b) => a.order - b.order),
    [data, revealed],
  );
  const [local, setLocal] = useState<Local>({});
  const isDone = (q: Question) => answered(q) || !!local[q.id];
  const firstOpen = questions.findIndex((q) => !isDone(q));
  const [picked, setPicked] = useState<number | null>(null);
  const index = picked ?? (firstOpen === -1 ? questions.length : firstOpen);
  const current = questions[index];
  const allDone = questions.length > 0 && questions.every(isDone);

  useEffect(() => {
    if (!allDone || picked !== null) return;
    const t = setTimeout(() => router.push(`/runs/${runId}`), 2600);
    return () => clearTimeout(t);
  }, [allDone, picked, router, runId]);

  const submit = async (q: Question, a: { value?: unknown; skip?: boolean }) => {
    setLocal((l) => ({ ...l, [q.id]: { value: a.value, skipped: a.skip } }));
    setPicked(null);
    try {
      await getClient().answer(runId, { answers: [{ questionId: q.id, value: a.value, skip: a.skip }] });
      qc.invalidateQueries({ queryKey: qk.questions(runId) });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        toast({ title: "This run already finished", body: "Your answer is kept for the next run's dossier only." });
      } else {
        setLocal(({ [q.id]: _drop, ...rest }) => rest);
        toast({ title: "The answer was not saved", body: e instanceof Error ? e.message : undefined, tone: "fail" });
      }
    }
  };

  if (isLoading) return <Skeleton className="mx-auto mt-10 h-72 max-w-3xl rounded-panel" />;
  if (!questions.length)
    return (
      <EmptyState
        className="mx-auto mt-6 max-w-2xl"
        title={liveStatus === "done" ? "This run asked nothing" : "No questions yet"}
        action={
          <Button asChild>
            <Link href={`/runs/${runId}`}>Back to the cockpit</Link>
          </Button>
        }
      >
        The consultation starts after research and the reverse-engineering step, and only asks what the data could not
        answer.
      </EmptyState>
    );

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-8 pt-4 pb-28 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-14 lg:pt-8">
        <Steps questions={questions} index={index} isDone={isDone} local={local} onPick={(i) => setPicked(i)} />
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {allDone && picked === null ? (
              <Finished key="done" questions={questions} local={local} runId={runId} />
            ) : current ? (
              <Stage
                key={current.id}
                q={current}
                index={index}
                total={questions.length}
                prior={local[current.id]}
                onSubmit={(a) => submit(current, a)}
              />
            ) : null}
          </AnimatePresence>
        </div>
        <ChatDrawer runId={runId} />
      </div>
    </MotionConfig>
  );
}

/** Numbered step list on desktop, a flat segmented bar on small screens. Any step can be reopened. */
function Steps({
  questions,
  index,
  isDone,
  local,
  onPick,
}: {
  questions: Question[];
  index: number;
  isDone: (q: Question) => boolean;
  local: Local;
  onPick: (i: number) => void;
}) {
  const done = questions.filter(isDone).length;
  return (
    <nav aria-label="Consultation progress" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-[13px] text-bone">Consultation</p>
        <p className="text-[12px] text-bone-2">
          <span className="font-mono tabular-nums">
            {done}/{questions.length}
          </span>{" "}
          answered
        </p>
      </div>
      <div className="mt-2 flex gap-[3px] lg:hidden">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => onPick(i)}
            aria-label={`Question ${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            className="flex-1 py-2"
          >
            <span
              className={cn(
                "block h-[5px] rounded-[1px] transition-colors duration-150",
                i === index ? "bg-signal" : isDone(q) ? "bg-bone" : "bg-line-strong",
              )}
            />
          </button>
        ))}
      </div>
      <ol className="mt-4 hidden border-line border-t lg:block">
        {questions.map((q, i) => {
          const cur = i === index;
          const o = isDone(q) ? outcome(q, local) : undefined;
          return (
            <li key={q.id}>
              <button
                onClick={() => onPick(i)}
                aria-current={cur ? "step" : undefined}
                className={cn(
                  "relative flex w-full gap-3 border-line border-b py-3 pr-2 pl-3 text-left transition-colors duration-150",
                  cur ? "bg-raised" : "hover:bg-raised-2/60",
                )}
              >
                {cur && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-signal" />}
                <span className="pt-px font-mono text-[11px] text-bone-3 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "line-clamp-2 text-[13px] leading-snug",
                      cur ? "font-medium text-bone" : o ? "text-bone-2" : "text-bone-3",
                    )}
                  >
                    {q.prompt}
                  </span>
                  {o && (
                    <span className={cn("mt-1 block truncate text-[12px]", o.skipped ? "text-warn" : "text-bone")}>
                      {o.skipped ? "Skipped, assumption stated" : o.text}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Stage({
  q,
  index,
  total,
  prior,
  onSubmit,
}: {
  q: Question;
  index: number;
  total: number;
  prior?: { value?: unknown };
  onSubmit: (a: { value?: unknown; skip?: boolean }) => void;
}) {
  const { runId } = useRunCtx();
  const { data: allEvidence } = useEvidence(runId);
  const evidence = (allEvidence ?? []).filter((e) => q.evidenceIds.includes(e.id));
  const [sheet, setSheet] = useState(false);
  const hasDefault = q.defaultAnswer !== undefined && q.defaultAnswer !== null;
  const keys = q.kind === "confirm" ? 2 : q.kind === "single" ? (q.options?.length ?? 0) : 0;
  return (
    <motion.section
      aria-labelledby={`q-${q.id}`}
      data-testid="question"
      data-kind={q.kind}
      className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_272px] lg:gap-x-12 lg:gap-y-10"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <header className="min-w-0 lg:col-start-1">
        <p className="mono-label">
          question {index + 1} of {total}
          {q.required ? "" : " / optional"}
        </p>
        <h2
          id={`q-${q.id}`}
          className="mt-4 max-w-[24ch] font-display text-[clamp(1.875rem,3.6vw,3rem)] text-bone leading-[1.06]"
        >
          {q.prompt}
        </h2>
        <p className="mt-5 max-w-[62ch] text-bone-2 text-body">
          <span className="font-medium text-bone">Why I am asking. </span>
          {q.why}
        </p>
      </header>

      {/* answers come before the evidence in the DOM (keyboard and test order); the grid moves evidence beside the question */}
      <div className="order-last min-w-0 lg:order-none lg:col-start-1">
        <AnswerInput q={q} prior={prior?.value} onSubmit={(value) => onSubmit({ value })} />
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-line border-t pt-4">
          <Button
            variant="quiet"
            size="sm"
            data-testid="skip"
            className="-ml-3"
            onClick={() => onSubmit({ skip: true, value: undefined })}
            title={
              hasDefault
                ? `The agent will assume: ${describeAnswer(q, q.defaultAnswer)}`
                : "The agent will state its assumption"
            }
          >
            Skip{hasDefault ? `, assume "${describeAnswer(q, q.defaultAnswer)}"` : ""}
          </Button>
          {keys > 0 && (
            <p className="hidden text-[12px] text-bone-3 md:block">
              Press <Kbd>A</Kbd> to <Kbd>{String.fromCharCode(64 + keys)}</Kbd> to answer
            </p>
          )}
        </div>
      </div>

      {evidence.length > 0 && (
        <aside
          aria-label="What triggered this question"
          className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-line lg:border-l lg:pl-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-[13px] text-bone">What triggered it</p>
            <button
              onClick={() => setSheet(true)}
              className="text-[12px] text-bone-2 underline decoration-line-strong underline-offset-4 hover:text-bone"
            >
              Open all
            </button>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2" data-testid="evidence-chips">
            {evidence.map((e) => (
              <li key={e.id} className="min-w-0">
                <EvidenceThumb evidence={e} onOpen={() => setSheet(true)} />
              </li>
            ))}
          </ul>
        </aside>
      )}

      <Sheet open={sheet} onOpenChange={setSheet} label="the evidence behind this question" title={q.prompt}>
        <div className="flex flex-col gap-3">
          {evidence.map((e: Evidence) => (
            <div key={e.id}>
              <p className="mb-1.5 mono-label">{SOURCE_LABELS[e.source]}</p>
              <EvidenceCard evidence={e} expanded />
            </div>
          ))}
        </div>
      </Sheet>
    </motion.section>
  );
}

/** The actual ad or post: its thumbnail when the source gave one, else a muted tile with source and title. */
function EvidenceThumb({ evidence: e, onOpen }: { evidence: Evidence; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const thumb = e.thumbnailUrl && !broken ? e.thumbnailUrl : undefined;
  const m = e.metrics;
  const metric =
    m.outlierScore != null
      ? `${m.outlierScore.toFixed(1)}x`
      : m.views != null
        ? formatCount(m.views)
        : m.rating != null
          ? `${m.rating.toFixed(1)}/5`
          : undefined;
  return (
    <button onClick={onOpen} className="group block w-full text-left" title={e.title}>
      <span className="block aspect-[4/5] overflow-hidden rounded-[4px] border border-line bg-raised-2 transition-colors duration-150 group-hover:border-bone-4">
        {thumb ? (
          // biome-ignore lint/performance/noImgElement: third-party thumbnail, linked, never re-hosted
          <img
            src={thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full flex-col justify-between gap-2 p-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-bone-2">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: sourceHue(e.source) }}
              />
              <span className="truncate">{SOURCE_LABELS[e.source]}</span>
            </span>
            <span className="line-clamp-5 font-medium text-[12px] text-bone leading-snug">{e.title}</span>
          </span>
        )}
      </span>
      <span className="mt-1.5 flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="truncate text-bone-3">{thumb ? SOURCE_LABELS[e.source] : e.kind.replaceAll("_", " ")}</span>
        {metric && <span className="shrink-0 font-mono text-bone tabular-nums">{metric}</span>}
      </span>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded-[3px] border border-line-strong bg-raised px-1 font-sans text-[11px] text-bone">
      {children}
    </kbd>
  );
}

// Flat answer rows with a 1px rule; selected = ink (set in ChipGroup via data-state).
const CHIPS =
  "max-w-[620px] flex-col items-stretch [&>button]:shadow-[inset_0_0_0_1px_var(--color-line-strong)] [&>button:hover]:shadow-[inset_0_0_0_1px_var(--color-bone-4)] [&>button[data-state=on]]:shadow-none";

function AnswerInput({ q, prior, onSubmit }: { q: Question; prior?: unknown; onSubmit: (v: unknown) => void }) {
  const [single, setSingle] = useState<string>(typeof prior === "string" ? prior : "");
  const [multi, setMulti] = useState<string[]>(Array.isArray(prior) ? (prior as string[]) : []);
  const [text, setText] = useState(typeof prior === "string" ? prior : "");
  const [scale, setScale] = useState<number>(
    typeof prior === "number" ? prior : typeof q.defaultAnswer === "number" ? q.defaultAnswer : (q.scale?.min ?? 0),
  );
  const flash = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flash.current), []);

  const pick = (v: unknown, show: () => void) => {
    show();
    clearTimeout(flash.current);
    flash.current = setTimeout(() => onSubmit(v), 220); // let the selected row register before the question leaves
  };

  // keyboard: letters pick options for single/confirm, Enter submits multi/scale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const opts = q.kind === "confirm" ? ["yes", "no"] : q.kind === "single" ? (q.options ?? []).map((o) => o.id) : [];
      const i = e.key.toLowerCase().charCodeAt(0) - 97;
      if (e.key.length === 1 && i >= 0 && i < opts.length) {
        e.preventDefault();
        if (q.kind === "confirm") pick(opts[i] === "yes", () => setSingle(opts[i]));
        else pick(opts[i], () => setSingle(opts[i]));
      }
      if (e.key === "Enter" && q.kind === "multi" && multi.length) onSubmit(multi);
      if (e.key === "Enter" && q.kind === "scale") onSubmit(scale);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (q.kind === "single")
    return (
      <ChipGroup
        className={CHIPS}
        type="single"
        options={withSuggested(q)}
        value={single}
        onChange={(v) => pick(v, () => setSingle(v))}
      />
    );
  if (q.kind === "confirm")
    return (
      <ChipGroup
        className={CHIPS}
        type="single"
        options={[
          { id: "yes", label: "Yes", hint: q.defaultAnswer === true ? "suggested" : undefined },
          { id: "no", label: "No", hint: q.defaultAnswer === false ? "suggested" : undefined },
        ]}
        value={single}
        onChange={(v) => pick(v === "yes", () => setSingle(v))}
      />
    );
  if (q.kind === "multi")
    return (
      <div className="flex flex-col items-start gap-5">
        <ChipGroup
          className={cn(CHIPS, "w-full")}
          type="multi"
          options={withSuggested(q)}
          value={multi}
          onChange={setMulti}
        />
        <Button variant="primary" disabled={!multi.length} onClick={() => onSubmit(multi)} data-testid="answer">
          Continue with {multi.length || "none"} selected
        </Button>
      </div>
    );
  if (q.kind === "scale") {
    const s = q.scale ?? { min: 0, max: 10, minLabel: "", maxLabel: "" };
    const step = s.max - s.min >= 500 ? 50 : 1;
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-5">
        <output
          className="font-mono text-[44px] text-bone leading-none tabular-nums"
          aria-live="polite"
          data-testid="scale-value"
        >
          {describeAnswer(q, scale)}
        </output>
        <input
          type="range"
          min={s.min}
          max={s.max}
          step={step}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="range"
          aria-label={q.prompt}
          style={{ "--v": `${((scale - s.min) / (s.max - s.min || 1)) * 100}%` } as React.CSSProperties}
        />
        <div className="flex w-full justify-between text-[12px] text-bone-3">
          <span>{s.minLabel}</span>
          <span>{s.maxLabel}</span>
        </div>
        <Button variant="primary" onClick={() => onSubmit(scale)} data-testid="answer">
          Use {describeAnswer(q, scale)}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex max-w-[640px] flex-col items-start gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text.trim());
      }}
    >
      <label htmlFor={`text-${q.id}`} className="sr-only">
        Your answer
      </label>
      <textarea
        id={`text-${q.id}`}
        value={text}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) onSubmit(text.trim());
        }}
        placeholder={typeof q.defaultAnswer === "string" ? q.defaultAnswer : "In your own words"}
        className="w-full resize-none rounded-card border border-line-strong bg-raised px-4 py-3 text-bone text-body outline-none transition-colors duration-150 hover:border-bone-4 focus:border-bone"
      />
      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={!text.trim()} data-testid="answer">
          Answer
        </Button>
        <span className="hidden text-[12px] text-bone-3 md:inline">
          or <Kbd>Cmd</Kbd>
          <Kbd>Enter</Kbd>
        </span>
      </div>
    </form>
  );
}

const withSuggested = (q: Question) =>
  (q.options ?? []).map((o) => ({
    ...o,
    hint:
      o.hint ??
      (q.defaultAnswer === o.id || (Array.isArray(q.defaultAnswer) && q.defaultAnswer.includes(o.id))
        ? "suggested"
        : undefined),
  }));

function Finished({ questions, local, runId }: { questions: Question[]; local: Local; runId: string }) {
  return (
    <motion.section
      data-testid="consult-done"
      className="max-w-[860px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <p className="mono-label">consultation complete</p>
      <h2 className="mt-4 font-display text-[clamp(1.875rem,3.6vw,3rem)] text-bone leading-[1.06]">
        Answers in. The run continues.
      </h2>
      <p className="mt-4 max-w-[62ch] text-bone-2 text-body">
        Every answer is now in the dossier and will be cited as &ldquo;because you said&rdquo;. Taking you back to the
        cockpit.
      </p>
      <ol className="mt-8 border-line border-t">
        {questions.map((q, i) => {
          const o = outcome(q, local);
          return (
            <li key={q.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 border-line border-b py-4">
              <span className="pt-0.5 font-mono text-[11px] text-bone-3 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-bone-2">{q.prompt}</p>
                <p className="mt-1 font-medium text-[17px] text-bone leading-snug">
                  {o.skipped && (
                    <span className="mr-2 font-semibold text-[11px] text-warn uppercase tracking-[0.06em]">
                      skipped
                    </span>
                  )}
                  {o.skipped
                    ? (q.assumption ?? `Assumed: ${describeAnswer(q, q.defaultAnswer) || "the common case"}`)
                    : o.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="primary" className="mt-8" asChild>
        <Link href={`/runs/${runId}`}>Back to the cockpit</Link>
      </Button>
    </motion.section>
  );
}

type Msg = { role: "user" | "agent"; text: string };

function ChatDrawer({ runId }: { runId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const stop = useRef<() => void>(undefined);
  useEffect(() => () => stop.current?.(), []);
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text }, { role: "agent", text: "" }]);
    stop.current = getClient().chat(runId, text, {
      onToken: (t) => setMsgs((m) => [...m.slice(0, -1), { role: "agent", text: m.at(-1)!.text + t }]),
      onQuestion: () => {
        qc.invalidateQueries({ queryKey: qk.questions(runId) });
        toast({ title: "The agent added a question", body: "It is now in the consultation." });
      },
      onDone: () => setBusy(false),
      onError: (m) => {
        setBusy(false);
        setMsgs((ms) => [...ms.slice(0, -1), { role: "agent", text: `The engine did not answer: ${m}` }]);
      },
    });
  };
  return (
    <div className="fixed right-4 bottom-4 z-40 md:right-8 md:bottom-8">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        label="free text / the agent reads the dossier and evidence"
        title="Tell it anything"
        trigger={
          <Button size="lg" data-testid="chat-open" className="max-md:h-10 max-md:px-4 max-md:text-ui">
            <ChatGlyph />
            Talk to the agent
          </Button>
        }
      >
        <div className="flex min-h-full flex-col">
          <ol className="flex flex-1 flex-col gap-3" aria-live="polite" data-testid="chat-log">
            {msgs.length === 0 && (
              <li className="text-bone-2 text-ui">
                Add context the questions missed: a constraint, a past campaign, a market. The agent may turn it into a
                new question.
              </li>
            )}
            {msgs.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "max-w-[90%] rounded-card px-4 py-3 text-ui",
                  m.role === "user" ? "self-end bg-bone text-ink" : "self-start border border-line bg-raised text-bone",
                )}
              >
                {m.text ? <Linkified text={m.text} /> : <span className="text-bone-3">Writing</span>}
              </li>
            ))}
          </ol>
          <form onSubmit={send} className="sticky bottom-0 mt-4 flex gap-2 bg-raised pt-3">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="We tried Reels in spring, nothing stuck"
              className="h-10 min-w-0 flex-1 rounded-chip border border-line-strong bg-raised px-4 text-bone text-ui outline-none transition-colors duration-150 placeholder:text-bone-4 focus:border-bone"
            />
            <Button type="submit" variant="primary" size="md" loading={busy} disabled={!draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v5.5A1.5 1.5 0 0 1 12 11H7l-3 2.5V11a1.5 1.5 0 0 1-1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Evidence ids the agent cites (ev_hound_05) render as mono tags. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/\b(ev_[a-z0-9_]+)\b/g);
  return (
    <>
      {parts.map((p, i) =>
        /^ev_[a-z0-9_]+$/.test(p) ? (
          <span key={i} className="mx-0.5 rounded-[3px] bg-raised-2 px-1 font-mono text-[11px] text-bone">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
