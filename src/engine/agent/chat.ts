import { z } from "zod";
import { type Question, QuestionKind } from "@/contracts";
import type { Db } from "../db/client";
import { HttpError } from "../http";
import { newId } from "../ids";
import {
  appendEvent,
  getBrand,
  getRun,
  insertChat,
  listChat,
  listEvidence,
  listQuestions,
  upsertQuestion,
} from "../repo";
import { rulePackText } from "../rules";
import { loadPrompt, text } from "./claude";
import { answersDigest, dossierDigest, evidenceDigest } from "./digest";

const ChatQuestion = z.object({
  kind: QuestionKind,
  prompt: z.string(),
  why: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
});

export interface ChatSink {
  token: (t: string) => void;
  question: (q: Question) => void;
}

/** Streams the assistant reply; text after a `<question>` marker is held back and turned into a question card. */
export async function chat(
  db: Db,
  runId: string,
  message: string,
  sink: ChatSink,
  opts: { mode?: "live" | "demo" } = {},
): Promise<{ messageId: string }> {
  const run = await getRun(db, runId);
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  const brand = await getBrand(db, run.brandId);
  if (!brand) throw new HttpError(404, "not_found", "Brand not found");
  await insertChat(db, { id: newId("msg"), runId, role: "user", content: message });
  const history = (await listChat(db, runId)).slice(-12);
  const [evidence, qs] = await Promise.all([listEvidence(db, runId), listQuestions(db, runId)]);
  const system = loadPrompt("chat", { rulePack: rulePackText(brand.rulePack) });
  const context = `CONTEXT (not from the operator)\nDOSSIER ${dossierDigest(brand)}\nQUESTIONS AND ANSWERS\n${answersDigest(qs)}\nEVIDENCE\n${evidenceDigest(evidence, 25)}`;

  let buf = "";
  let sent = 0;
  let held = false;
  const onText = (t: string) => {
    buf += t;
    if (held) return;
    const idx = buf.indexOf("<question");
    if (idx >= 0) {
      if (idx > sent) sink.token(buf.slice(sent, idx));
      sent = idx;
      held = true;
      return;
    }
    // hold back a possible partial marker at the end
    const lt = buf.lastIndexOf("<");
    const safe = lt >= sent && buf.length - lt < 9 ? lt : buf.length;
    if (safe > sent) sink.token(buf.slice(sent, safe));
    sent = Math.max(sent, safe);
  };
  const top = evidence[0];
  const r = await text(
    { db, runId, phase: "consult", mode: opts.mode },
    {
      route: "chat",
      system,
      messages: [
        { role: "user", content: context },
        { role: "assistant", content: "Understood. I have the dossier, answers and evidence." },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      note: "consult chat",
      maxTokens: 2000,
      onText,
      demo: () =>
        `Noted, I will factor that in. ${top ? `For reference, the strongest signal so far is "${top.title}" [${top.id}]. ` : ""}This is demo mode, so the reply is a placeholder rather than a live strategist answer.`,
    },
  );
  if (!held && sent < buf.length) sink.token(buf.slice(sent));
  const full = r.value;
  const m = full.match(/<question>([\s\S]*?)<\/question>/);
  const reply = full.replace(/<question>[\s\S]*?(<\/question>|$)/, "").trim();
  const messageId = newId("msg");
  await insertChat(db, { id: messageId, runId, role: "assistant", content: reply });
  if (m) {
    try {
      const parsed = ChatQuestion.parse(JSON.parse(m[1]));
      const q: Question = {
        id: newId("q"),
        runId,
        order: qs.length + 1,
        kind: parsed.kind,
        prompt: parsed.prompt,
        why: parsed.why,
        evidenceIds: [],
        options: parsed.options,
        required: false,
        assumption: "Proceed with the current plan.",
      };
      await upsertQuestion(db, q);
      await appendEvent(db, { runId, phase: "consult", type: "question", title: q.prompt, refId: q.id, detail: q.why });
      sink.question(q);
    } catch {
      // malformed question block: the text reply still stands
    }
  }
  return { messageId };
}
