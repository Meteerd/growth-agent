"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import type { Concept, RenderVersion } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { clock, formatUsd } from "@/lib/client/format";
import { qk, useRenders, useVariants } from "@/lib/client/queries";

const SUGGESTIONS = ["Fix the voice", "Music more upbeat", "Bigger hook text", "Replace a shot", "Make it Czech"];

const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined);

/** B22: versions of the render, revise by chat (with clarifying questions), compare two versions, pick per-shot takes. */
export function Revise({ c }: { c: Concept }) {
  const qc = useQueryClient();
  const { data: versions = [] } = useRenders(c.id);
  const [selected, setSelected] = useState<string>();
  const [compare, setCompare] = useState<string>();
  const [comparing, setComparing] = useState(false);
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState<{ question: string; options: string[] }>();
  const [busy, setBusy] = useState(false);
  const newest = versions.at(-1)?.id;
  // a new version takes the player as soon as it appears
  useEffect(() => setSelected(newest), [newest]);
  const current = versions.find((v) => v.id === selected) ?? versions.at(-1);
  const other = versions.find((v) => v.id === compare) ?? versions.find((v) => v.id !== current?.id);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.renders(c.id) }),
      qc.invalidateQueries({ queryKey: qk.conceptAssets(c.id) }),
      qc.invalidateQueries({ queryKey: qk.concepts(c.runId) }),
      qc.invalidateQueries({ queryKey: qk.packs(c.runId) }),
    ]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const res = await getClient().revise(c.id, { message, fromRenderId: current?.id });
      if (res.status === "needs_clarification") setQuestion({ question: res.question, options: res.options });
      else {
        setQuestion(undefined);
        setMsg("");
        toast({ title: "The agent is making a new version", body: res.plan.summary });
        await refresh();
      }
    } catch (e) {
      toast({ title: "The revision did not start", body: errorText(e), tone: "fail" });
    } finally {
      setBusy(false);
    }
  };

  if (!versions.length) return null;
  return (
    <section aria-label="Versions" data-testid="revise" className="glass-flat flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono-label">
          Versions <span className="font-mono text-bone-3">{versions.length}</span>
        </p>
        {versions.length > 1 && (
          <button
            type="button"
            aria-pressed={comparing}
            data-testid="compare-toggle"
            onClick={() => setComparing((x) => !x)}
            className={cn(
              "rounded-chip px-3 py-1.5 text-[12.5px] transition-colors duration-150",
              comparing
                ? "bg-bone text-ink"
                : "text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:text-bone",
            )}
          >
            {comparing ? "Close the comparison" : "Compare two versions"}
          </button>
        )}
      </div>

      <div
        className={cn("grid gap-3", comparing && other ? "grid-cols-2" : "grid-cols-1")}
        data-testid="version-players"
      >
        {current && <Player v={current} />}
        {comparing && other && <Player v={other} />}
      </div>

      <ol className="flex gap-2 overflow-x-auto pb-1" data-testid="version-strip">
        {versions.map((v) => {
          const on = v.id === current?.id;
          return (
            <li key={v.id} className="w-[220px] shrink-0">
              <button
                type="button"
                onClick={() => (comparing && !on ? setCompare(v.id) : setSelected(v.id))}
                className={cn(
                  "flex h-full w-full flex-col gap-1.5 rounded-card p-3 text-left transition-colors duration-150",
                  on ? "bg-raised shadow-[inset_0_0_0_1.5px_var(--color-bone)]" : "bg-raised-2 hover:bg-raised",
                  comparing && v.id === other?.id && "shadow-[inset_0_0_0_1.5px_var(--color-signal)]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-bone">v{v.version}</span>
                  {v.chosen && <Badge tone="pass">in use</Badge>}
                  {v.status === "rendering" && (
                    <Badge tone="signal" dot>
                      rendering
                    </Badge>
                  )}
                  {v.status === "failed" && <Badge tone="fail">failed</Badge>}
                </span>
                <span className="line-clamp-2 text-[12.5px] text-bone-2 leading-snug">
                  {v.plan?.summary ?? v.message ?? "The first render"}
                </span>
                <span className="mt-auto flex gap-3 font-mono text-[11px] text-bone-3">
                  <span>{v.review ? `review ${v.review.overall}/100` : v.message ? "review pending" : "original"}</span>
                  <span>{formatUsd(v.costUsd)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {current && !current.chosen && current.status === "ready" && (
        <button
          type="button"
          data-testid="use-version"
          onClick={async () => {
            try {
              await getClient().chooseRender(c.id, current.id);
              await refresh();
              toast({ title: `v${current.version} is now the version in use`, body: "Packs use it from now on." });
            } catch (e) {
              toast({ title: "Could not switch versions", body: errorText(e), tone: "fail" });
            }
          }}
          className="self-start rounded-chip bg-bone px-4 py-2 font-medium text-[13px] text-ink hover:bg-[#2a2a2a]"
        >
          Use v{current.version}
        </button>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(msg);
        }}
      >
        <label htmlFor="revise-input" className="text-[13px] text-bone">
          Tell the agent what to change
        </label>
        <div className="flex gap-2">
          <input
            id="revise-input"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. a warmer voice, the hook text bigger, shot 3 calmer"
            className="min-w-0 flex-1 rounded-card bg-raised px-3 py-2 text-[14px] shadow-[inset_0_0_0_1px_var(--color-line-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-bone)]"
          />
          <button
            type="submit"
            disabled={busy || !msg.trim()}
            className="rounded-card bg-signal px-4 font-medium text-[13px] text-white disabled:opacity-50"
          >
            {busy ? "Asking" : "Send"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => send(s)}
              className="rounded-chip px-2.5 py-1 text-[12px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:text-bone"
            >
              {s}
            </button>
          ))}
        </div>
      </form>

      {question && (
        <div className="rounded-card bg-raised-2 p-4" data-testid="revise-question" aria-live="polite">
          <p className="mono-label">The agent asks</p>
          <p className="mt-1 font-medium text-[15px] text-bone">{question.question}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {question.options.map((o) => (
              <button
                key={o}
                type="button"
                disabled={busy}
                onClick={() => send(o)}
                className="rounded-chip bg-raised px-3 py-1.5 text-[13px] text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1.5px_var(--color-bone)]"
              >
                {o}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-bone-3">Or write your own answer in the box above.</p>
        </div>
      )}

      <Takes c={c} onReassemble={() => send("Re-assemble with the takes I picked, change nothing else")} />
    </section>
  );
}

function Player({ v }: { v: RenderVersion }) {
  return (
    <figure className="overflow-hidden rounded-card bg-viewer">
      {v.status === "ready" && v.assetUrl ? (
        <video
          key={v.assetUrl}
          src={v.assetUrl}
          poster={v.posterUrl}
          muted
          loop
          playsInline
          autoPlay
          controls
          className="mx-auto aspect-[9/16] max-h-[380px] w-auto"
        />
      ) : (
        <div className="grid aspect-[9/16] max-h-[380px] place-items-center px-4 text-center text-[13px] text-white/70">
          {v.status === "failed" ? (v.error ?? "This version failed") : `Rendering v${v.version}`}
        </div>
      )}
      <figcaption className="border-[#222] border-t px-3 py-2 font-mono text-[11px] text-white/70">
        v{v.version}
        {v.review ? `, review ${v.review.overall}/100` : ""}
      </figcaption>
    </figure>
  );
}

/** Per-shot takes from fal and Higgsfield: pick one per shot, then re-assemble. */
function Takes({ c, onReassemble }: { c: Concept; onReassemble: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useVariants(open ? c.id : undefined);
  const shots = data?.shots.filter((s) => s.variants.length) ?? [];
  return (
    <div className="border-line border-t pt-4" data-testid="takes">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[13px] text-bone underline underline-offset-4"
      >
        {open ? "Hide the takes per shot" : "Pick takes per shot (fal and Higgsfield)"}
      </button>
      {open && !shots.length && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[12.5px] text-bone-2">
            No alternative takes yet. One take per provider per shot costs render credits.
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                await getClient().makeVariants(c.id);
                toast({ title: "Rendering takes from fal and Higgsfield", body: "They appear here as they finish." });
                setTimeout(() => qc.invalidateQueries({ queryKey: qk.variants(c.id) }), 4000);
              } catch (e) {
                toast({ title: "Takes did not start", body: errorText(e), tone: "fail" });
              }
            }}
            className="rounded-chip px-3 py-1.5 text-[12.5px] text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
          >
            Get takes
          </button>
        </div>
      )}
      {open && shots.length > 0 && (
        <>
          <ul className="mt-3 flex flex-col gap-3">
            {shots.map((s) => (
              <li key={s.idx} className="flex items-start gap-3">
                <span className="w-14 shrink-0 pt-1 font-mono text-[12px] text-bone-3">shot {s.idx + 1}</span>
                <div className="flex gap-2 overflow-x-auto">
                  {s.variants.map((v) => (
                    <figure key={v.clipId} className="w-[92px] shrink-0">
                      <video
                        src={v.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        className="aspect-[9/16] w-full rounded-[4px] bg-viewer object-cover"
                      />
                      <figcaption className="mt-1 flex items-center justify-between gap-1 text-[11px]">
                        <span className="truncate text-bone-2">{v.provider}</span>
                        {v.chosen ? (
                          <span className="text-pass">in use</span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await getClient()
                                .chooseClip(c.id, s.idx, v.clipId)
                                .catch((e) =>
                                  toast({ title: "Could not pick that take", body: errorText(e), tone: "fail" }),
                                );
                              await qc.invalidateQueries({ queryKey: qk.variants(c.id) });
                            }}
                            className="text-bone underline underline-offset-2"
                          >
                            Use
                          </button>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onReassemble}
            className="mt-3 rounded-chip bg-bone px-3 py-1.5 text-[12.5px] text-ink"
          >
            Re-assemble with these takes
          </button>
        </>
      )}
    </div>
  );
}

/** The soundtrack of the latest final render: the cast voice, the music bed and the sound effects on the time axis. */
export function Soundtrack({ c }: { c: Concept }) {
  const a = c.audio;
  if (!a || (!a.voice && !a.music && !a.sfx?.length)) return null;
  const total = c.shots.reduce((s, x) => s + x.durationSec, 0) || 1;
  return (
    <section aria-label="Sound" data-testid="soundtrack" className="glass-flat flex flex-col gap-3 p-4">
      <p className="mono-label">Sound</p>
      {a.voice && (
        <p className="text-[13px]">
          <span className="text-bone-3">Voice </span>
          <span className="text-bone">{a.voice.name}</span>
          <span className="text-bone-3"> / ElevenLabs</span>
        </p>
      )}
      {a.music && (
        <div>
          <div className="flex h-6 items-center rounded-[3px] bg-[#2e6f73] px-2 text-[11.5px] text-white">
            <span className="truncate">Music: {a.music.label}</span>
          </div>
          {a.music.prompt && <p className="mt-1 line-clamp-2 text-[11.5px] text-bone-3">{a.music.prompt}</p>}
        </div>
      )}
      {!!a.sfx?.length && (
        <div>
          <div className="relative h-5 rounded-[3px] bg-raised-2" aria-hidden>
            {a.sfx.map((x) => (
              <span
                key={`${x.t}${x.label}`}
                title={`${clock(x.t * 1000)} ${x.label}`}
                className="absolute top-0 h-full w-[3px] bg-[#b7791f]"
                style={{ left: `${Math.min(99, (x.t / total) * 100)}%` }}
              />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-bone-3">
            {a.sfx.map((x) => (
              <li key={`${x.t}${x.label}`}>
                {clock(x.t * 1000)} {x.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
