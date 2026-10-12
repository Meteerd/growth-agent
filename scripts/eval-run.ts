/**
 * pnpm eval-run <runId>: quality checks on a run's outputs (no API calls).
 * Grounding (evidence ids), rule-pack hard lines, remake integrity, and the writing rules (no em dashes).
 */
import { loadEnv } from "./env";

loadEnv();
const runId = process.argv[2];
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { patternHits } = await import("@/engine/rules");
const { conceptText } = await import("@/engine/compliance/check");
const db = await getDb();
const run = await repo.getRun(db, runId);
if (!run) throw new Error("run not found");
const brand = (await repo.getBrand(db, run.brandId))!;
const fails: string[] = [];
const ok: string[] = [];
const check = (cond: boolean, msg: string) => (cond ? ok : fails).push(msg);
const EM = /\u2014|\s\u2013\s/; // em dashes and dash-as-punctuation; numeric ranges like 3–5 are fine

const evidence = await repo.listEvidence(db, runId);
const ids = new Set(evidence.map((e) => e.id));
const qs = await repo.listQuestions(db, runId);
check(
  qs.length === 0 || qs.every((q) => q.answer !== undefined || q.skipped),
  "every question was answered or explicitly skipped (the run paused to consult)",
);
for (const q of qs) {
  check(q.why.length > 20, `question has a why: ${q.prompt.slice(0, 50)}`);
  check(
    q.evidenceIds.every((i) => ids.has(i)),
    `question evidence ids resolve: ${q.prompt.slice(0, 50)}`,
  );
  check(!EM.test(`${q.prompt} ${q.why}`), `no em dash in question: ${q.prompt.slice(0, 50)}`);
}
const plan = await repo.getLatestPlan(db, runId);
if (plan) {
  for (const c of plan.channels) {
    const grounded =
      (c.evidenceIds.length > 0 && c.evidenceIds.every((i) => ids.has(i))) ||
      (c.answerIds?.length ?? 0) > 0 ||
      /(thin|no [^.]*(data|evidence)|rests on the dossier)/i.test(c.rationale);
    check(grounded, `channel ${c.channel} is grounded (evidence ids, answers, or says the evidence is thin)`);
    check(!EM.test(c.rationale), `no em dash in ${c.channel} rationale`);
  }
  if (brand.rulePack === "eu_rx_telehealth")
    check(!plan.channels.some((c) => c.channel === "meta_ads"), "a.clinic: Meta paid not recommended (RX4)");
  if (brand.vertical === "b2b_saas")
    check(!plan.channels.slice(0, 3).some((c) => c.channel === "tiktok"), "B2B: TikTok not in the top 3");
  check(!EM.test(plan.summary), "no em dash in plan summary");
  // a skipped question must never be cited as something the operator said
  const skipped = qs.filter((q) => q.skipped || q.answer === undefined).map((q) => q.id);
  const planText = `${plan.summary} ${plan.channels.map((c) => c.rationale).join(" ")} ${plan.notNow.map((n) => n.reason).join(" ")}`;
  const misattributed = skipped.filter((id) => new RegExp(`you said[^.]*\\(?${id}`, "i").test(planText));
  check(
    misattributed.length === 0,
    `skipped answers are not cited as "you said"${misattributed.length ? ` (${misattributed.join(", ")})` : ""}`,
  );
}
for (const c of await repo.listConcepts(db, runId)) {
  const text = conceptText(c);
  const hits = patternHits(brand.rulePack, text, {
    paid: ["meta_ads", "tiktok_ads", "google_ads"].includes(c.channel),
  }).filter((h) => h.severity === "block");
  check(
    hits.length === 0,
    `concept passes hard rule patterns: ${c.title.slice(0, 50)}${hits.length ? ` (${hits.map((h) => `${h.ruleId} "${h.excerpt}"`).join(", ")})` : ""}`,
  );
  check(
    !EM.test(
      `${c.hook} ${c.caption} ${c.body ?? ""} ${c.shots.map((s) => `${s.onScreenText ?? ""} ${s.voiceover ?? ""}`).join(" ")}`,
    ),
    `no em dash in concept copy: ${c.title.slice(0, 50)}`,
  );
  if (c.blueprintId) {
    const bp = await repo.getBlueprint(db, c.blueprintId);
    check(
      !!bp && c.shotMap?.length === bp.shots.length && c.shots.length === bp.shots.length,
      `remake maps 1:1 to its blueprint: ${c.title.slice(0, 50)}`,
    );
  }
  check(
    c.remakesEvidenceIds.every((i) => ids.has(i)),
    `concept evidence ids resolve: ${c.title.slice(0, 50)}`,
  );
}
console.log(`${brand.name} ${runId}: ${ok.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL", f);
process.exit(fails.length ? 1 : 0);
