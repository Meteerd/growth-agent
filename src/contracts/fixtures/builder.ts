import type {
  Asset,
  Blueprint,
  BlueprintShot,
  Brand,
  ChannelPlan,
  ChannelRec,
  ComplianceCheck,
  Concept,
  Connection,
  Deconstruction,
  Evidence,
  EvidenceMetrics,
  PublishPack,
  Question,
  Review,
  Run,
  RunEvent,
  Shot,
} from "../entities";
import type {
  Aspect,
  BlueprintStructure,
  Channel,
  ChannelMode,
  ConceptFormat,
  EvidenceKind,
  EvidenceSource,
  Phase,
  ProviderId,
  RunEventType,
  ShotPurpose,
  ShotType,
} from "../enums";

/** Everything one complete GTM run produced. Lane B's mock replays `events`; the engine replays the rest. */
export interface DemoRunBundle {
  brand: Brand;
  run: Run;
  connections: Connection[];
  evidence: Evidence[];
  blueprints: Blueprint[];
  questions: Question[];
  plan: ChannelPlan;
  concepts: Concept[];
  compliance: ComplianceCheck[];
  packs: PublishPack[];
  assets: Asset[];
  reviews: Review[];
  events: RunEvent[];
}

export const DEMO_CAPTURED_AT = "2026-10-11T21:00:00.000Z";
const T0 = Date.parse("2026-10-11T21:00:00.000Z");

export function iso(offsetSec: number): string {
  return new Date(T0 + offsetSec * 1000).toISOString();
}

// ---------------------------------------------------------------- evidence

export interface EvSpec {
  n: number;
  source: EvidenceSource;
  kind: EvidenceKind;
  title: string;
  author?: string;
  url?: string;
  text?: string;
  m?: EvidenceMetrics;
  d?: Deconstruction;
  tags?: string[];
}

export function evId(slug: string, n: number): string {
  return `ev_${slug}_${String(n).padStart(2, "0")}`;
}

export function makeEvidence(brand: Brand, runId: string, specs: EvSpec[]): Evidence[] {
  return specs.map((s) => ({
    id: evId(brand.slug, s.n),
    brandId: brand.id,
    runId,
    source: s.source,
    kind: s.kind,
    url: s.url,
    title: s.title,
    author: s.author,
    text: s.text,
    metrics: s.m ?? {},
    deconstruction: s.d,
    tags: s.tags ?? [],
    capturedAt: DEMO_CAPTURED_AT,
    demo: true,
  }));
}

// ---------------------------------------------------------------- questions

export interface QSpec {
  kind: Question["kind"];
  prompt: string;
  why: string;
  ev: number[];
  options?: [string, string, string?][];
  def?: unknown;
  required?: boolean;
  fills?: string;
  scale?: Question["scale"];
}

export function makeQuestions(brand: Brand, runId: string, specs: QSpec[], answered: boolean): Question[] {
  return specs.map((q, i) => ({
    id: `q_${brand.slug}_${i + 1}`,
    runId,
    order: i + 1,
    kind: q.kind,
    prompt: q.prompt,
    why: q.why,
    evidenceIds: q.ev.map((n) => evId(brand.slug, n)),
    options: q.options?.map(([id, label, hint]) => ({ id, label, ...(hint ? { hint } : {}) })),
    defaultAnswer: q.def,
    required: q.required ?? true,
    fills: q.fills,
    scale: q.scale,
    ...(answered ? { answer: q.def, answeredAt: iso(300 + i * 20) } : {}),
  }));
}

// ---------------------------------------------------------------- plan

export type Scores6 = [number, number, number, number, number, number];

export const DEFAULT_WEIGHTS = {
  audience: 0.25,
  provenWins: 0.2,
  productionFit: 0.15,
  complianceRisk: 0.15,
  speedToSignal: 0.1,
  modelFit: 0.15,
};

export function weightedScore(s: Scores6, w = DEFAULT_WEIGHTS): number {
  const v =
    s[0] * w.audience +
    s[1] * w.provenWins +
    s[2] * w.productionFit +
    s[3] * w.complianceRisk +
    s[4] * w.speedToSignal +
    s[5] * w.modelFit;
  return Math.round(v);
}

export interface RecSpec {
  channel: Channel;
  s: Scores6;
  mode: ChannelMode;
  rationale: string;
  ev: number[];
  formats: string[];
  cadence: string;
  firstSteps: string[];
  kpis: string[];
  targets: string[];
}

export function scoresObj(s: Scores6) {
  return {
    audience: s[0],
    provenWins: s[1],
    productionFit: s[2],
    complianceRisk: s[3],
    speedToSignal: s[4],
    modelFit: s[5],
  };
}

export function makePlan(
  brand: Brand,
  runId: string,
  summary: string,
  recs: RecSpec[],
  notNow: { channel: Channel; reason: string; ev: number[]; s?: Scores6 }[],
  weights = DEFAULT_WEIGHTS,
): ChannelPlan {
  const channels: ChannelRec[] = recs
    .map((r) => ({
      channel: r.channel,
      priority: 0,
      score: weightedScore(r.s, weights),
      scores: scoresObj(r.s),
      mode: r.mode,
      rationale: r.rationale,
      evidenceIds: r.ev.map((n) => evId(brand.slug, n)),
      formats: r.formats,
      cadence: r.cadence,
      firstSteps: r.firstSteps,
      kpis: r.kpis,
      targets: r.targets,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, priority: i + 1 }));
  return {
    id: `plan_${brand.slug}_v1`,
    runId,
    brandId: brand.id,
    version: 1,
    summary,
    weights,
    channels,
    notNow: notNow.map((n) => ({
      channel: n.channel,
      reason: n.reason,
      evidenceIds: n.ev.map((x) => evId(brand.slug, x)),
    })),
    considered: [
      ...channels.map((c) => ({ channel: c.channel, score: c.score, scores: c.scores })),
      ...notNow
        .filter((n) => n.s)
        .map((n) => ({ channel: n.channel, score: weightedScore(n.s!, weights), scores: scoresObj(n.s!) })),
    ],
    createdAt: iso(420),
  };
}

// ---------------------------------------------------------------- concepts

export type ShotSpec = [durationSec: number, visualPrompt: string, onScreenText?: string, voiceover?: string];

export interface ConceptSpec {
  channel: Channel;
  format: ConceptFormat;
  title: string;
  hook: string;
  angle: string;
  language: string;
  shots: ShotSpec[];
  caption: string;
  hashtags: string[];
  cta: string;
  remakes: number[];
  remakeNote: string;
  body?: string;
  aspect?: Aspect;
  /** index (0-based) of the blueprint in the bundle this concept remakes; shots map 1:1 in order */
  blueprint?: string;
  /** 0-based index of the concept this is a format variant of */
  variantOf?: number;
}

/** Rough draft cost: keyframes ($0.04 each) + draft image-to-video ($0.05/s) + TTS. Demo runs spend $0. */
export function estimateConceptCost(shots: { durationSec: number }[]): number {
  const seconds = shots.reduce((a, s) => a + s.durationSec, 0);
  return Math.round((shots.length * 0.04 + seconds * 0.05 + 0.02) * 100) / 100;
}

export function makeConcepts(brand: Brand, runId: string, specs: ConceptSpec[]): Concept[] {
  return specs.map((c, i) => {
    const shots: Shot[] = c.shots.map(([durationSec, visualPrompt, onScreenText, voiceover], idx) => ({
      idx,
      durationSec,
      visualPrompt,
      onScreenText,
      voiceover,
      approved: false,
    }));
    return {
      id: `concept_${brand.slug}_${i + 1}`,
      runId,
      brandId: brand.id,
      channel: c.channel,
      format: c.format,
      title: c.title,
      hook: c.hook,
      angle: c.angle,
      language: c.language,
      shots,
      caption: c.caption,
      hashtags: c.hashtags,
      cta: c.cta,
      remakesEvidenceIds: c.remakes.map((n) => evId(brand.slug, n)),
      compliance: "pass",
      estimatedCostUsd: shots.length ? estimateConceptCost(shots) : 0,
      status: "draft",
      createdAt: iso(480 + i * 15),
      remakeNote: c.remakeNote,
      body: c.body,
      revisions: 0,
      aspect: c.aspect ?? (c.format === "text_post" ? "1:1" : "9:16"),
      ...(c.blueprint
        ? { blueprintId: c.blueprint, shotMap: shots.map((s) => ({ shotIdx: s.idx, blueprintShotIdx: s.idx })) }
        : {}),
      ...(c.variantOf !== undefined ? { variantOf: `concept_${brand.slug}_${c.variantOf + 1}` } : {}),
    };
  });
}

// ---------------------------------------------------------------- blueprints + reviews

export type BpShotSpec = [
  t0: number,
  t1: number,
  shotType: ShotType,
  purpose: ShotPurpose,
  subject: string,
  action: string,
  onScreenText?: string,
  voiceover?: string,
];

export interface BlueprintSpec {
  evidence: number;
  structure: BlueprintStructure;
  hook: Blueprint["hook"];
  shots: BpShotSpec[];
  emotionalArc: string;
  cta: Blueprint["cta"];
  whyItWins: string;
  transcript?: string;
  camera?: string;
}

export function makeBlueprint(brand: Brand, runId: string, spec: BlueprintSpec, i = 1): Blueprint {
  const shots: BlueprintShot[] = spec.shots.map(
    ([t0, t1, shotType, purpose, subject, action, onScreenText, voiceover], idx) => ({
      idx,
      t0,
      t1,
      shotType,
      camera: spec.camera ?? "handheld phone, static",
      subject,
      action,
      onScreenText,
      voiceover,
      transition: idx === 0 ? undefined : "hard cut",
      purpose,
    }),
  );
  const durationSec = shots.at(-1)?.t1 ?? 0;
  return {
    id: `bp_${brand.slug}_${i}`,
    evidenceId: evId(brand.slug, spec.evidence),
    brandId: brand.id,
    runId,
    durationSec,
    aspect: "9:16",
    structure: spec.structure,
    hook: spec.hook,
    shots,
    pacing: {
      cutsPer10s: Math.round(((shots.length - 1) / durationSec) * 100) / 10,
      avgShotSec: Math.round((durationSec / shots.length) * 10) / 10,
    },
    emotionalArc: spec.emotionalArc,
    cta: spec.cta,
    whyItWins: spec.whyItWins,
    transcript: spec.transcript,
    frames: [],
    demo: true,
    createdAt: iso(200 + i * 10),
  };
}

/** Two review rounds for one rendered concept: round 1 finds the weakest shot and regenerates it, round 2 accepts. */
export function makeReviews(
  brand: Brand,
  concept: Concept,
  round1: number[],
  weakest: { idx: number; issues: string[] },
): {
  reviews: Review[];
  assets: Asset[];
} {
  const assets: Asset[] = [1, 2].map((r) => ({
    id: `asset_${concept.id}_video_r${r}`,
    brandId: brand.id,
    conceptId: concept.id,
    kind: "video",
    url: `/api/assets/demo/${brand.slug}/${concept.id}_r${r}.mp4`,
    provider: "local",
    model: "remotion-kenburns",
    costUsd: 0,
    width: 1080,
    height: 1920,
    durationSec: concept.shots.reduce((a, s) => a + s.durationSec, 0),
    demo: true,
    createdAt: iso(600 + r * 20),
  }));
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const round2 = round1.map((s, i) => (i === weakest.idx ? Math.max(s + 24, 80) : Math.min(100, s + 3)));
  const reviews: Review[] = [
    {
      id: `review_${concept.id}_1`,
      conceptId: concept.id,
      assetId: assets[0].id,
      round: 1,
      overall: avg(round1),
      blueprintMatch: avg(round1) + 6,
      perShot: round1.map((score, idx) => ({ idx, score, issues: idx === weakest.idx ? weakest.issues : [] })),
      complianceOk: true,
      decision: "regenerate",
      notes: `Shot ${weakest.idx + 1} is the weakest (${round1[weakest.idx]}): ${weakest.issues.join("; ")}. Regenerating its keyframe and re-rendering.`,
      createdAt: iso(625),
      regeneratedShots: [weakest.idx],
      demo: true,
    },
    {
      id: `review_${concept.id}_2`,
      conceptId: concept.id,
      assetId: assets[1].id,
      round: 2,
      overall: avg(round2),
      blueprintMatch: avg(round2) + 4,
      perShot: round2.map((score, idx) => ({ idx, score, issues: [] })),
      complianceOk: true,
      decision: "accept",
      notes: "Hook lands inside 2 s, text inside safe zones, pacing matches the blueprint. Accepted.",
      createdAt: iso(650),
      demo: true,
    },
  ];
  concept.status = "rendered";
  concept.videoAssetId = assets[1].id;
  return { reviews, assets };
}

export function makeCompliance(
  brand: Brand,
  concepts: Concept[],
  extra: { conceptIdx: number; findings: ComplianceCheck["findings"] }[] = [],
): ComplianceCheck[] {
  const out: ComplianceCheck[] = [];
  concepts.forEach((c, i) => {
    const failed = extra.find((e) => e.conceptIdx === i);
    if (failed) {
      out.push({
        id: `cc_${brand.slug}_${i + 1}_a0`,
        targetType: "concept",
        targetId: c.id,
        rulePack: brand.rulePack,
        status: "fail",
        findings: failed.findings,
        createdAt: iso(560 + i * 10),
        attempt: 0,
      });
      c.revisions = 1;
    }
    out.push({
      id: `cc_${brand.slug}_${i + 1}_a${failed ? 1 : 0}`,
      targetType: "concept",
      targetId: c.id,
      rulePack: brand.rulePack,
      status: "pass",
      findings: [],
      createdAt: iso(565 + i * 10),
      attempt: failed ? 1 : 0,
    });
  });
  return out;
}

const PLATFORM_CHECKLIST: Partial<Record<Channel, string[]>> = {
  tiktok: [
    "Turn on the AI-generated content label in TikTok if any shot is AI-made",
    "Post between 18:00 and 21:00 local",
  ],
  instagram_reels: ["Add the AI info label if any shot is AI-made", "Share to Stories after posting"],
  youtube_shorts: ["Mark altered or synthetic content in YouTube Studio if any shot is AI-made"],
  reddit: [
    "Read the subreddit rules in the sidebar before posting",
    "Disclose that you work on the product",
    "Reply to every comment in the first hour",
  ],
  linkedin: ["Post from the founder's profile, not the company page", "Reply to comments within 2 hours"],
};

export function makePacks(brand: Brand, runId: string, concepts: Concept[]): PublishPack[] {
  return concepts.map((c, i) => ({
    id: `pack_${brand.slug}_${i + 1}`,
    conceptId: c.id,
    brandId: brand.id,
    platform: c.channel,
    imageAssetIds: [],
    caption: c.caption,
    hashtags: c.hashtags,
    firstComment: c.cta,
    checklist: [
      "Compliance check passed for this rule pack",
      ...(PLATFORM_CHECKLIST[c.channel] ?? []),
      "After posting, paste the post URL here (mark posted)",
    ],
    status: "ready",
    createdAt: iso(640 + i * 5),
    runId,
  }));
}

export function makeConnections(
  brand: Brand,
  live: ProviderId[],
  demo: ProviderId[],
  missing: ProviderId[],
): Connection[] {
  const mk = (provider: ProviderId, status: Connection["status"], summary: string): Connection => ({
    id: `conn_${brand.slug}_${provider}`,
    brandId: brand.id,
    provider,
    status,
    config: {},
    summary,
  });
  return [
    ...live.map((p) => mk(p, "live", "Key present and verified")),
    ...demo.map((p) => mk(p, "demo", "Demo data (labelled)")),
    ...missing.map((p) => mk(p, "missing", "Not connected")),
  ];
}

// ---------------------------------------------------------------- events

const SOURCE_TOOL: Partial<Record<EvidenceSource, { tool: string; provider: ProviderId }>> = {
  website: { tool: "crawl_site", provider: "firecrawl" },
  meta_ad_library: { tool: "search_meta_ads", provider: "apify" },
  spiral: { tool: "spiral_brand_winners", provider: "spiral" },
  tiktok: { tool: "search_tiktok", provider: "apify" },
  instagram: { tool: "search_instagram", provider: "apify" },
  youtube: { tool: "search_youtube_shorts", provider: "youtube" },
  reddit: { tool: "search_reddit", provider: "apify" },
  app_store: { tool: "fetch_app_reviews", provider: "apify" },
  play_store: { tool: "fetch_app_reviews", provider: "apify" },
  google_maps: { tool: "fetch_maps_reviews", provider: "apify" },
  trustpilot: { tool: "fetch_trustpilot", provider: "apify" },
  manus_research: { tool: "manus_deep_research", provider: "manus" },
};

/** Deterministic event log for a complete run, in the same shape the engine emits live. */
export function buildEvents(b: Omit<DemoRunBundle, "events">): RunEvent[] {
  const ev: RunEvent[] = [];
  let t = 0;
  const push = (phase: Phase, type: RunEventType, title: string, extra: Partial<RunEvent> = {}) => {
    t += 2;
    ev.push({ id: ev.length + 1, runId: b.run.id, ts: iso(t), phase, type, title, ...extra });
  };
  const runId = b.run.id;
  push("intake", "status", "Run started", { data: { status: "running" } });

  // intake
  push("intake", "phase_started", "Reading the brand");
  push("intake", "tool_call", `crawl_site ${b.brand.url}`, { data: { tool: "crawl_site", provider: "firecrawl" } });
  push("intake", "tool_result", "Site crawled: offer, proof, tone, visual identity", {
    detail: b.brand.dossier.positioning,
  });
  push("intake", "thinking", `Gaps to close: ${b.brand.dossier.gaps.slice(0, 3).join("; ")}`);
  push("intake", "phase_completed", "Dossier ready", { refId: b.brand.id });

  // research
  push("research", "phase_started", "Gathering evidence");
  const bySource = new Map<EvidenceSource, Evidence[]>();
  for (const e of b.evidence) bySource.set(e.source, [...(bySource.get(e.source) ?? []), e]);
  for (const [source, items] of bySource) {
    const tool = SOURCE_TOOL[source] ?? { tool: `fetch_${source}`, provider: "apify" as ProviderId };
    push("research", "tool_call", `${tool.tool} (${items.length} items)`, { data: { ...tool, source } });
    for (const e of items) {
      push("research", "evidence", e.title, {
        refId: e.id,
        detail: e.deconstruction?.hook ? `Hook: ${e.deconstruction.hook}` : e.text?.slice(0, 160),
        data: { source: e.source, kind: e.kind, metrics: e.metrics },
      });
    }
    push("research", "tool_result", `${items.length} ${source} items normalized`, { data: { source } });
  }
  const decon = b.evidence.filter((e) => e.deconstruction).length;
  push("research", "thinking", `Deconstructed ${decon} winners: hooks, formats, beats, CTAs`);
  push("research", "cost", "Research cost (demo: no live spend)", { costUsd: 0 });
  push("research", "phase_completed", `${b.evidence.length} evidence items from ${bySource.size} sources`);

  // reverse engineer
  push("reverse_engineer", "phase_started", "Watching the winners shot by shot");
  for (const bp of b.blueprints) {
    const src = b.evidence.find((e) => e.id === bp.evidenceId);
    push("reverse_engineer", "tool_call", `watch_video: ${src?.title ?? bp.evidenceId}`, {
      data: { tool: "watch_video", evidenceId: bp.evidenceId },
    });
    push(
      "reverse_engineer",
      "blueprint",
      `Blueprint: ${bp.shots.length} shots, ${bp.structure}, hook ends at ${bp.hook.endSec}s`,
      {
        refId: bp.id,
        detail: bp.whyItWins,
      },
    );
  }
  push("reverse_engineer", "phase_completed", `${b.blueprints.length} blueprint(s)`);

  // consult
  push("consult", "phase_started", "Consultation: only what the data could not answer");
  for (const q of b.questions) push("consult", "question", q.prompt, { refId: q.id, detail: q.why });
  push("consult", "status", "Waiting for your answers", { data: { status: "waiting_input" } });
  for (const q of b.questions.filter((x) => x.answer !== undefined)) {
    push("consult", "log", `Answer recorded: ${q.prompt}`, { refId: q.id, data: { answer: q.answer } });
  }
  push("consult", "status", "Answers in, continuing", { data: { status: "running" } });
  push("consult", "phase_completed", "Dossier updated from answers");

  // direction
  push("direction", "phase_started", "Deciding where to go");
  for (const c of b.plan.channels) {
    push("direction", "thinking", `${c.channel}: ${c.score}/100`, { detail: c.rationale });
  }
  for (const n of b.plan.notNow) push("direction", "thinking", `Not now: ${n.channel}`, { detail: n.reason });
  push("direction", "plan", b.plan.summary, { refId: b.plan.id });
  push("direction", "phase_completed", `Channel plan v${b.plan.version}`);

  // production + compliance
  push("production", "phase_started", "Writing concepts that remake proven structures");
  for (const c of b.concepts) push("production", "concept", c.title, { refId: c.id, detail: c.hook });
  push("production", "phase_completed", `${b.concepts.length} concepts`);
  if (b.reviews.length) {
    push("review", "phase_started", "Watching our own render");
    for (const r of b.reviews) {
      push("review", "review", `Round ${r.round}: ${r.overall}/100, ${r.decision}`, {
        refId: r.id,
        detail: r.notes,
        data: { conceptId: r.conceptId, round: r.round, decision: r.decision },
      });
    }
    push("review", "phase_completed", "Self-review done");
  }
  push("compliance", "phase_started", `Checking against ${b.brand.rulePack}`);
  for (const cc of b.compliance) {
    push(
      "compliance",
      "compliance",
      `${cc.status.toUpperCase()}: ${b.concepts.find((c) => c.id === cc.targetId)?.title}`,
      {
        refId: cc.id,
        detail: cc.findings.map((f) => `${f.ruleId}: ${f.message}`).join(" | ") || undefined,
        data: { targetId: cc.targetId, status: cc.status, attempt: cc.attempt },
      },
    );
  }
  push("compliance", "phase_completed", "All concepts pass");

  // pack
  push("pack", "phase_started", "Building ready-to-post packs");
  for (const p of b.packs) push("pack", "pack", `Pack ready: ${p.platform}`, { refId: p.id });
  push("pack", "phase_completed", `${b.packs.length} packs ready`);
  push("pack", "status", "Run complete", { data: { status: "done" } });
  void runId;
  return ev;
}
