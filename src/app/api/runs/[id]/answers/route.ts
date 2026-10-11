import { AnswersRequest } from "@/contracts";
import { submitAnswers } from "@/engine/agent/phases/consult";
import { db, handle, json, parseBody } from "@/engine/http";
import { startRun } from "@/engine/jobs/runner";
import { getRun } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Answers resume the run once every required question is answered or skipped. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/runs/[id]/answers">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, AnswersRequest);
  const d = await db();
  const { questions, ready } = await submitAnswers(d, id, body.answers);
  const run = await getRun(d, id);
  if (ready && run?.status === "waiting_input") startRun(id);
  return json(questions);
});
