"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/client/cn";
import { api, useRefresh } from "@/lib/client/studio";

interface Msg {
  role: "user" | "assistant";
  text: string;
  tools: { name: string; input?: unknown; summary?: string; isError?: boolean }[];
}

const THREAD = "main";

const LABEL: Record<string, string> = {
  list_brands: "Looked at the brands",
  get_brand: "Read the brand",
  add_brand: "Started brand setup",
  update_brand_config: "Updated the brand config",
  update_dossier: "Updated the brand facts",
  scan_competitors: "Started a competitor scan",
  analyze_competitors: "Started the competitor teardown",
  get_playbook: "Read the playbook",
  list_competitor_ads: "Looked at competitor ads",
  generate_ads: "Started generating ads",
  list_ads: "Looked at the ads",
  get_ad: "Opened an ad",
  revise_ad: "Started a revision",
  set_ad_status: "Changed an ad's status",
  get_job: "Checked a job",
  list_jobs: "Checked the jobs",
  cancel_job: "Cancelled a job",
  get_spend: "Checked the spend",
  update_settings: "Changed settings",
  list_formats: "Read the format library",
};

const SUGGEST = [
  "Set up a.clinic for Slovakia and Czechia, scan its competitors and make the first 6 ads.",
  "What are Hound's competitors running right now, and what wins?",
  "Make 4 Hound statics that remake the strongest competitor ads, plus 1 carousel.",
  "How much have we spent so far, and which image model should I use?",
];

/** Minimal formatting: paragraphs, bullet lines, **bold**. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const isList = lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l));
        const fmt = (s: string) =>
          s
            .split(/(\*\*[^*]+\*\*)/g)
            .map((p, j) => (p.startsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>));
        return isList ? (
          <ul key={i} className="list-disc space-y-1 pl-4">
            {lines.map((l, j) => (
              <li key={j}>{fmt(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {fmt(b)}
          </p>
        );
      })}
    </div>
  );
}

export function Chat({ brand }: { brand?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const refresh = useRefresh();

  useEffect(() => {
    api
      .get<Msg[]>(`/chat?thread=${THREAD}`)
      .then((m) => setMsgs(m.map((x) => ({ ...x, tools: x.tools.map((t) => ({ name: t.name, input: t.input })) }))))
      .catch(() => undefined);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every change
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setMsgs((m) => [...m, { role: "user", text, tools: [] }, { role: "assistant", text: "", tools: [] }]);
    const patch = (fn: (last: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), fn(m[m.length - 1]!)]);
    try {
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread: THREAD, message: text, brand }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx = buf.indexOf("\n\n");
        while (idx >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          idx = buf.indexOf("\n\n");
          const ev = frame.match(/^event: (.+)$/m)?.[1];
          const data = JSON.parse(frame.match(/^data: (.+)$/m)?.[1] ?? "{}");
          if (ev === "text") patch((l) => ({ ...l, text: l.text + data.text }));
          else if (ev === "tool") patch((l) => ({ ...l, tools: [...l.tools, { name: data.name, input: data.input }] }));
          else if (ev === "tool_result") {
            patch((l) => {
              const tools = [...l.tools];
              const i = tools.map((t) => t.name).lastIndexOf(data.name);
              if (i >= 0) tools[i] = { ...tools[i]!, summary: data.summary, isError: data.isError };
              return { ...l, tools };
            });
            refresh();
          } else if (ev === "error")
            patch((l) => ({ ...l, text: `${l.text}\n\nSomething went wrong: ${data.message}` }));
        }
      }
    } catch (e) {
      patch((l) => ({ ...l, text: `${l.text}\n\nSomething went wrong: ${e instanceof Error ? e.message : e}` }));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function clear() {
    await api.del(`/chat?thread=${THREAD}`);
    setMsgs([]);
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-line border-b px-4 py-3">
        <div>
          <div className="font-medium text-[14px]">Agent</div>
          <div className="text-[12px] text-bone-3">{brand ? `Looking at ${brand}` : "All brands"}</div>
        </div>
        {msgs.length > 0 && (
          <button type="button" onClick={clear} className="text-[12px] text-bone-3 hover:text-bone">
            New chat
          </button>
        )}
      </div>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[13.5px] leading-relaxed">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-bone-2">
              Tell me what to make. I can add a brand from its website, scan what competitors run, write the playbook,
              make statics and carousels, and revise them from your notes.
            </p>
            <div className="space-y-2">
              {SUGGEST.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full rounded-lg border border-line px-3 py-2 text-left text-[13px] text-bone-2 hover:border-line-strong hover:text-bone"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn(m.role === "user" && "flex justify-end")}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#F3F1EC] px-3.5 py-2 whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div className="space-y-2">
                {m.tools.length > 0 && (
                  <div className="space-y-1">
                    {m.tools.map((t, j) => (
                      <div
                        key={j}
                        className={cn("flex items-center gap-2 text-[12px]", t.isError ? "text-fail" : "text-bone-3")}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            t.summary === undefined && busy
                              ? "animate-pulse bg-signal"
                              : t.isError
                                ? "bg-fail"
                                : "bg-pass",
                          )}
                        />
                        {LABEL[t.name] ?? t.name}
                      </div>
                    ))}
                  </div>
                )}
                {m.text ? (
                  <Rich text={m.text} />
                ) : busy && i === msgs.length - 1 ? (
                  <span className="text-bone-3">Thinking...</span>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-line border-t p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={3}
          placeholder={busy ? "Working..." : "Ask for ads, feedback, a new brand..."}
          className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] outline-none focus:border-line-strong"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-bone px-3.5 py-1.5 text-[13px] text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
