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

export function Consult() {
  const { runId, revealed, liveStatus } = useRunCtx();
  const { data, isLoading } = useQuestions(runId);
  const qc = useQueryClient();
  const router = useRouter();
  const questions = useMemo(
    () => (data ?? []).filter((q) => revealed.has(q.id)).sort((a, b) => a.order - b.order),
    [data, revealed],
  );
  const [local, setLocal] = useState<Record<string, { value?: unknown; skipped?: boolean }>>({});
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
      <div className="relative mx-auto flex min-h-[70vh] max-w-[980px] flex-col items-center pb-24">
        <Constellation questions={questions} index={index} isDone={isDone} onPick={(i) => setPicked(i)} />
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
        <ChatDrawer runId={runId} />
      </div>
    </MotionConfig>
  );
}

function Constellation({
  questions,
  index,
  isDone,
  onPick,
}: {
  questions: Question[];
  index: number;
  isDone: (q: Question) => boolean;
  onPick: (i: number) => void;
}) {
  const n = questions.length;
  const W = 520;
  const pts = questions.map((_, i) => ({
    x: 20 + (i * (W - 40)) / Math.max(1, n - 1),
    y: 26 + Math.sin(i * 1.3) * 12,
  }));
  return (
    <nav aria-label="Consultation progress" className="w-full max-w-[520px]">
      <svg viewBox={`0 0 ${W} 56`} className="w-full overflow-visible" aria-hidden>
        {pts.slice(1).map((p, i) => {
          const a = pts[i];
          const lit = isDone(questions[i]) && isDone(questions[i + 1]);
          return (
            <line
              key={`l${i}`}
              x1={a.x}
              y1={a.y}
              x2={p.x}
              y2={p.y}
              stroke={lit ? "rgb(17 17 17 / 0.5)" : "rgb(17 17 17 / 0.1)"}
              strokeWidth="1"
              style={{ transition: "stroke 600ms" }}
            />
          );
        })}
        {pts.map((p, i) => {
          const done = isDone(questions[i]);
          const cur = i === index;
          return (
            <g key={questions[i].id}>
              {cur && <circle cx={p.x} cy={p.y} r="11" fill="none" stroke="rgb(229 50 45 / 0.5)" className="" />}
              <circle
                cx={p.x}
                cy={p.y}
                r={done ? 4.5 : 3.5}
                fill={done ? "#ECE7DD" : cur ? "#E5322D" : "#06070A"}
                stroke={done || cur ? "none" : "rgb(17 17 17 / 0.35)"}
                style={{
                  filter: done ? "drop-shadow(0 0 6px rgb(17 17 17 / 0.6))" : undefined,
                  transition: "all 500ms",
                }}
              />
            </g>
          );
        })}
      </svg>
      <ol className="sr-only">
        {questions.map((q, i) => (
          <li key={q.id}>
            <button onClick={() => onPick(i)}>
              Question {i + 1}: {q.prompt} ({isDone(q) ? "answered" : "open"})
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-1 flex justify-between">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => onPick(i)}
            aria-label={`Question ${i + 1}`}
            className={cn(
              "font-mono text-[10px] transition-colors",
              i === index ? "text-signal" : isDone(q) ? "text-bone-2" : "text-bone-4 hover:text-bone-2",
            )}
          >
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
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
  return (
    <motion.section
      aria-labelledby={`q-${q.id}`}
      data-testid="question"
      data-kind={q.kind}
      className="mt-14 flex w-full flex-col items-center text-center"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -28, filter: "blur(2px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="mono-label">
        question {index + 1} of {total}
        {q.required ? "" : " / optional"}
      </p>
      <h2
        id={`q-${q.id}`}
        className="mt-5 max-w-[860px] font-display text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.04] tracking-[-0.01em]"
      >
        {q.prompt}
      </h2>
      <p className="mt-5 max-w-[640px] font-mono text-[12px] text-bone-2 leading-relaxed">
        <span className="text-bone-3">why I am asking / </span>
        {q.why}
      </p>
      {evidence.length > 0 && (
        <div className="mt-5 flex max-w-[760px] flex-wrap justify-center gap-1.5" data-testid="evidence-chips">
          {evidence.map((e, i) => (
            <motion.button
              key={e.id}
              onClick={() => setSheet(true)}
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.06, type: "spring", stiffness: 300, damping: 24 }}
              className="flex max-w-[260px] items-center gap-2 rounded-chip bg-glass px-3 py-1.5 text-left shadow[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-glass-strong"
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: sourceHue(e.source) }} />
              <span className="truncate text-[12px] text-bone-2">{e.title}</span>
              {e.metrics.outlierScore != null && (
                <span className="shrink-0 font-mono text-[10.5px] text-signal">
                  {e.metrics.outlierScore.toFixed(1)}x
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}
      <div className="mt-10 w-full max-w-[760px]">
        <AnswerInput q={q} prior={prior?.value} onSubmit={(value) => onSubmit({ value })} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="quiet"
          size="sm"
          data-testid="skip"
          onClick={() => onSubmit({ skip: true, value: undefined })}
          title={
            hasDefault
              ? `The agent will assume: ${describeAnswer(q, q.defaultAnswer)}`
              : "The agent will state its assumption"
          }
        >
          Skip{hasDefault ? `, assume "${describeAnswer(q, q.defaultAnswer)}"` : ""}
        </Button>
      </div>
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
    flash.current = setTimeout(() => onSubmit(v), 380); // let the chip flash signal before the question leaves
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
        className="justify-center"
        type="single"
        options={withSuggested(q)}
        value={single}
        onChange={(v) => pick(v, () => setSingle(v))}
      />
    );
  if (q.kind === "confirm")
    return (
      <ChipGroup
        className="justify-center"
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
      <div className="flex flex-col items-center gap-5">
        <ChipGroup
          className="justify-center"
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
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5">
        <output
          className="font-mono text-[48px] leading-none tabular-nums"
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
        <div className="flex w-full justify-between font-mono text-[11px] text-bone-3">
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
      className="mx-auto flex max-w-[640px] flex-col items-stretch gap-3"
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
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) onSubmit(text.trim());
        }}
        placeholder={typeof q.defaultAnswer === "string" ? q.defaultAnswer : "In your own words"}
        className="glass w-full resize-none rounded-panel px-5 py-4 text-left text-bone text-body outline-none focus:shadow[var(--shadow-panel-strong),0_0_0_1px_rgb(229_50_45/0.45)]"
      />
      <Button type="submit" variant="primary" className="self-center" disabled={!text.trim()} data-testid="answer">
        Answer
      </Button>
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

function Finished({
  questions,
  local,
  runId,
}: {
  questions: Question[];
  local: Record<string, { value?: unknown; skipped?: boolean }>;
  runId: string;
}) {
  return (
    <motion.section
      data-testid="consult-done"
      className="mt-14 flex w-full flex-col items-center text-center"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="mono-label">consultation complete</p>
      <h2 className="mt-5 font-display text-[clamp(2.2rem,5vw,4rem)] leading-none">Answers in. The run continues.</h2>
      <p className="mt-4 text-bone-2 text-body">
        Every answer is now in the dossier and will be cited as &ldquo;because you said&rdquo;.
      </p>
      <ul className="mt-10 grid w-full max-w-[860px] gap-2 text-left md:grid-cols-2">
        {questions.map((q) => {
          const l = local[q.id];
          const skipped = l?.skipped ?? q.skipped;
          const value = l ? l.value : q.answer;
          return (
            <li key={q.id} className="glass-flat p-4">
              <p className="text-[12px] text-bone-3">{q.prompt}</p>
              <p className="mt-1 font-display text-[19px]">
                {skipped && (
                  <span className="mr-2 font-mono text-[10.5px] text-warn uppercase tracking-[0.06em]">skipped</span>
                )}
                {skipped
                  ? (q.assumption ?? `Assumed: ${describeAnswer(q, q.defaultAnswer) || "the common case"}`)
                  : describeAnswer(q, value)}
              </p>
            </li>
          );
        })}
      </ul>
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
          <Button size="lg" className="shadow[var(--shadow-panel-strong)]" data-testid="chat-open">
            <span className="size-1.5 rounded-full bg-signal" />
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
                  m.role === "user"
                    ? "self-end bg-bone text-ink"
                    : "self-start bg-glass text-bone shadow[inset_0_0_0_1px_var(--color-line)]",
                )}
              >
                {m.text ? (
                  <Linkified text={m.text} />
                ) : (
                  <span className="font-mono text-[11px] text-bone-3">thinking</span>
                )}
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
              className="h-10 min-w-0 flex-1 rounded-chip bg-glass px-4 text-bone text-ui outline-none shadow[inset_0_0_0_1px_var(--color-line-strong)] placeholder:text-bone-4 focus:shadow[inset_0_0_0_1px_rgb(229_50_45/0.5)]"
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

/** Evidence ids the agent cites (ev_hound_05) render as mono tags. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/\b(ev_[a-z0-9_]+)\b/g);
  return (
    <>
      {parts.map((p, i) =>
        /^ev_[a-z0-9_]+$/.test(p) ? (
          <span key={i} className="mx-0.5 rounded-[4px] bg-[rgb(229_50_45/0.1)] px-1 font-mono text-[11px] text-signal">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
