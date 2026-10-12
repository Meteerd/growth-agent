import {
  type Brand,
  type BrandSummary,
  CHANNEL_LABELS,
  type ChannelPlan,
  type Concept,
  type Connection,
  DEMO_RUNS,
  type DemoRunBundle,
  type MetricSnapshot,
  PROVIDER_IDS,
  PROVIDER_INFO,
  type ProviderStatus,
  type PublishPack,
  type Question,
  type RenderVersion,
  type Run,
  type RunEvent,
} from "@/contracts";
import { ApiRequestError, type DataClient } from "../api";
import type { RunStreamHandlers } from "../sse";
import { displayHost, slugify } from "../url";
import { createPlayer } from "./player";

// shortcut: mock state lives in memory for one page load (client navigation keeps it, a reload resets it);
// persist to sessionStorage if the demo ever needs mock mode across reloads.

export const MOCK_VIDEO = "/media/sample.mp4";
const RUN_MS = Number(process.env.NEXT_PUBLIC_MOCK_RUN_MS ?? 60_000);

type RunRec = {
  run: Run;
  slug: string;
  bundle: DemoRunBundle;
  events: RunEvent[];
  emitted: number;
  listeners: Set<RunStreamHandlers>;
  player?: ReturnType<typeof createPlayer>;
};

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const notFound = (what: string) => Object.assign(new Error(`${what} not found`), { status: 404, code: "not_found" });

/** Re-ids a demo bundle for a fresh run so concepts/packs/questions never collide across runs. */
function forkBundle(b: DemoRunBundle, slug: string, runId: string, brand: Brand): DemoRunBundle {
  const tag = runId.split("_").pop()!;
  let s = JSON.stringify(b)
    .replaceAll(b.run.id, runId)
    .replace(new RegExp(`"(bp|q|plan|concept|cc|pack)_${slug}_`, "g"), `"$1_${slug}_${tag}_`)
    .replace(new RegExp(`(asset|review)_concept_${slug}_`, "g"), `$1_concept_${slug}_${tag}_`);
  if (brand.id !== b.brand.id) s = s.replaceAll(b.brand.id, brand.id).replaceAll(`"${b.brand.name}`, `"${brand.name}`);
  const f = JSON.parse(s) as DemoRunBundle;
  // A fresh run starts with unanswered questions, draft concepts and unposted packs.
  f.questions = f.questions.map(({ answer: _a, answeredAt: _t, skipped: _s, assumption: _as, ...q }) => q as Question);
  f.concepts = f.concepts.map((c) => ({
    ...c,
    status: c.shots.length ? "keyframes" : "draft",
    shots: c.shots.map((sh) => ({ ...sh, approved: false })),
  }));
  f.packs = f.packs.map(({ postedUrl: _u, postedAt: _p, ...p }) => ({ ...p, status: "ready" }) as PublishPack);
  return f;
}

function withMockMedia(b: DemoRunBundle) {
  for (const a of b.assets) if (a.kind === "video") a.url = MOCK_VIDEO;
  return b;
}

/** Moves a recorded timeline so it starts at `startMs`, keeping the scripted gaps between events. */
function shiftTimes(events: RunEvent[], startMs: number) {
  const t0 = Date.parse(events[0]?.ts ?? new Date(startMs).toISOString());
  return events.map((e) => ({ ...e, ts: new Date(startMs + Date.parse(e.ts) - t0).toISOString() }));
}

function intakeEvents(runId: string, url: string, name: string): RunEvent[] {
  const ev = (id: number, type: RunEvent["type"], title: string, extra: Partial<RunEvent> = {}): RunEvent => ({
    id,
    runId,
    ts: now(),
    phase: "intake",
    type,
    title,
    ...extra,
  });
  return [
    ev(1, "status", "Run started", { data: { status: "running" } }),
    ev(2, "phase_started", `Reading ${name}`),
    ev(3, "tool_call", `crawl_site ${url}`, { data: { tool: "crawl_site", provider: "firecrawl" } }),
    ev(4, "tool_result", "Mock mode: the site is not crawled; the dossier starts empty", {
      data: { tool: "crawl_site" },
    }),
    ev(5, "thinking", "Gaps to close: offer, pricing, proof, audience, tone", { phase: "intake" }),
    ev(6, "phase_completed", "Dossier draft ready"),
    ev(7, "status", "Intake complete", { data: { status: "done" } }),
  ];
}

export function createMockClient(): DataClient {
  const brands = new Map<string, Brand>();
  const connections = new Map<string, Connection[]>();
  const runs = new Map<string, RunRec>();
  const snapshots = new Map<string, MetricSnapshot[]>();
  let seq = 0;

  for (const [slug, b] of Object.entries(DEMO_RUNS)) {
    const bundle = withMockMedia(clone(b));
    brands.set(bundle.brand.id, bundle.brand);
    connections.set(bundle.brand.id, bundle.connections);
    runs.set(bundle.run.id, {
      run: bundle.run,
      slug,
      bundle,
      events: bundle.events,
      emitted: bundle.events.length,
      listeners: new Set(),
    });
    for (const p of bundle.packs) snapshots.set(p.id, []);
  }

  const brandOf = (idOrSlug: string) => {
    const b = brands.get(idOrSlug) ?? [...brands.values()].find((x) => x.slug === idOrSlug);
    if (!b) throw notFound("brand");
    return b;
  };
  const runOf = (id: string) => {
    const r = runs.get(id);
    if (!r) throw notFound("run");
    return r;
  };
  const conceptOf = (id: string) => {
    for (const r of runs.values()) {
      const c = r.bundle.concepts.find((x) => x.id === id);
      if (c) return { r, c };
    }
    throw notFound("concept");
  };
  const packOf = (id: string) => {
    for (const r of runs.values()) {
      const p = r.bundle.packs.find((x) => x.id === id);
      if (p) return { r, p };
    }
    throw notFound("pack");
  };
  const runsFor = (brandId: string) =>
    [...runs.values()]
      .filter((r) => r.run.brandId === brandId)
      .sort((a, b) => (b.run.startedAt ?? "").localeCompare(a.run.startedAt ?? ""));

  const emit = (rec: RunRec, e: RunEvent) => {
    rec.emitted = Math.max(rec.emitted, e.id);
    const status = (e.data as { status?: Run["status"] } | undefined)?.status;
    rec.run = {
      ...rec.run,
      phase: e.phase,
      ...(e.type === "status" && status ? { status } : {}),
      costUsd: rec.run.costUsd + (e.costUsd ?? 0),
      ...(status === "done" ? { finishedAt: e.ts } : {}),
    };
    for (const l of rec.listeners) l.onEvent(e);
    if (status === "done" || status === "failed" || status === "cancelled")
      for (const l of rec.listeners) l.onEnd?.({ status });
  };

  const play = (rec: RunRec) => {
    rec.player = createPlayer(rec.events, {
      totalMs: rec.events.length < 20 ? 4_000 : RUN_MS,
      startIndex: rec.emitted,
      onEvent: (e) => emit(rec, e),
    });
    rec.player.start();
  };

  const newRun = (brand: Brand, kind: Run["kind"] = "full", makeEvents?: (runId: string) => RunEvent[]): RunRec => {
    const id = `run_${brand.slug}_m${++seq}`;
    const template = DEMO_RUNS[brand.slug] ?? DEMO_RUNS.hound;
    const bundle = withMockMedia(forkBundle(template, template.brand.slug, id, brand));
    const run: Run = {
      id,
      brandId: brand.id,
      kind,
      status: "queued",
      phase: "intake",
      costUsd: 0,
      startedAt: now(),
      demo: true,
      dataset: "demo",
      createdAt: now(),
    } as Run;
    const rec: RunRec = {
      run,
      slug: brand.slug,
      bundle,
      events: makeEvents
        ? makeEvents(id)
        : shiftTimes(
            bundle.events.map((e) => ({ ...e, runId: id })),
            Date.now(),
          ),
      emitted: 0,
      listeners: new Set(),
    };
    runs.set(id, rec);
    for (const p of bundle.packs) snapshots.set(p.id, []);
    play(rec);
    return rec;
  };

  const summary = (b: Brand): BrandSummary => {
    const rs = runsFor(b.id);
    const packs = rs.flatMap((r) => r.bundle.packs);
    const views = packs.reduce((sum, p) => sum + (snapshots.get(p.id)?.at(-1)?.views ?? 0), 0);
    const last = rs[0]?.run;
    return {
      ...b,
      counts: {
        runs: rs.length,
        packsReady: packs.filter((p) => p.status === "ready").length,
        packsPosted: packs.filter((p) => p.status === "posted").length,
        totalViews: views,
      },
      lastRun: last && {
        id: last.id,
        status: last.status,
        phase: last.phase,
        startedAt: last.startedAt,
        finishedAt: last.finishedAt,
      },
    };
  };

  /** Only what the stream has revealed so far, so mock and live look identical mid-run. */
  const revealed = (rec: RunRec) =>
    new Set(rec.events.slice(0, rec.emitted).flatMap((e) => (e.refId ? [e.refId] : [])));

  const versions = new Map<string, RenderVersion[]>();
  const asked = new Set<string>();
  const clips = new Map<string, string>();
  const versionsOf = (id: string) => {
    let list = versions.get(id);
    if (!list) {
      const { r, c } = conceptOf(id);
      const video = r.bundle.assets.find((a) => a.conceptId === id && a.kind === "video");
      list = video
        ? [
            {
              id: `render_${id}_1`,
              conceptId: id,
              version: 1,
              status: "ready",
              assetUrl: video.url,
              shots: c.shots.map((sh) => ({ idx: sh.idx, provider: "still" })),
              costUsd: 0,
              chosen: true,
              createdAt: video.createdAt,
            },
          ]
        : [];
      versions.set(id, list);
    }
    return list;
  };

  const client: DataClient = {
    mode: "mock",
    async brands() {
      await wait();
      return [...brands.values()].map(summary);
    },
    async brand(id) {
      await wait(60);
      return clone(brandOf(id));
    },
    async createBrand(req) {
      await wait(300);
      const first = displayHost(req.url).split(".")[0];
      const name = req.name ?? first.charAt(0).toLocaleUpperCase() + first.slice(1);
      let slug = slugify(name);
      while ([...brands.values()].some((b) => b.slug === slug)) slug += "-2";
      const brand: Brand = {
        id: `brand_${slug}`,
        slug,
        name,
        url: req.url,
        vertical: req.vertical ?? "other",
        countries: req.countries ?? [],
        languages: req.languages ?? ["en"],
        rulePack: "general",
        demo: true,
        createdAt: now(),
        updatedAt: now(),
        dossier: {
          oneLiner: "",
          positioning: "",
          offers: [],
          personas: [],
          voice: { tone: "", do: [], dont: [] },
          proof: [],
          claimsAllowed: [],
          claimsForbidden: [],
          visual: { colors: [] },
          competitors: [],
          gaps: ["Offer and pricing", "Who buys and why", "Proof (reviews, numbers)", "Tone of voice"],
          sources: [{ url: req.url, fetchedAt: now() }],
        },
      };
      brands.set(brand.id, brand);
      connections.set(
        brand.id,
        PROVIDER_IDS.map(
          (p) =>
            ({ id: `conn_${slug}_${p}`, brandId: brand.id, provider: p, status: "demo", config: {} }) as Connection,
        ),
      );
      const rec = newRun(brand, "research_only", (runId) => intakeEvents(runId, req.url, name));
      return { brand: clone(brand), run: clone(rec.run) };
    },
    async patchDossier(id, patch) {
      await wait(200);
      const b = brandOf(id);
      const next = { ...b, dossier: { ...b.dossier, ...patch }, updatedAt: now() };
      brands.set(b.id, next);
      return clone(next);
    },
    async connections(id) {
      await wait(80);
      return clone(connections.get(brandOf(id).id) ?? []);
    },
    async connect(id, req) {
      await wait(200);
      const b = brandOf(id);
      const list = connections.get(b.id) ?? [];
      const existing = list.find((c) => c.provider === req.provider);
      const c: Connection = {
        ...(existing ?? {
          id: `conn_${b.slug}_${req.provider}`,
          brandId: b.id,
          provider: req.provider,
          status: "demo",
        }),
        config: req.config ?? {},
      } as Connection;
      connections.set(b.id, [...list.filter((x) => x.provider !== req.provider), c]);
      return clone(c);
    },
    async brandRuns(id) {
      await wait(80);
      return runsFor(brandOf(id).id).map((r) => clone(r.run));
    },
    async startRun(id, req) {
      await wait(200);
      return clone(newRun(brandOf(id), req?.kind ?? "full").run);
    },
    async run(id) {
      await wait(40);
      return clone(runOf(id).run);
    },
    async cancelRun(id) {
      const r = runOf(id);
      r.player?.stop();
      emit(r, {
        id: r.emitted + 1,
        runId: id,
        ts: now(),
        phase: r.run.phase,
        type: "status",
        title: "Cancelled by operator",
        data: { status: "cancelled" },
      });
      return clone(r.run);
    },
    subscribeRun(id, handlers, opts) {
      const r = runs.get(id);
      if (!r) {
        handlers.onState?.("closed");
        return () => {};
      }
      const from = opts?.lastEventId ?? 0;
      handlers.onState?.("open");
      // Replay what already happened (async like a network stream; `pace` spaces it like the live ?pace=).
      // Live events that arrive during the replay are queued and flushed after it, so order is preserved.
      const past = r.events.slice(0, r.emitted).filter((e) => e.id > from);
      const pace = opts?.pace ?? 0;
      const queued: RunEvent[] = [];
      let replaying = true;
      const sub: RunStreamHandlers = {
        ...handlers,
        onEvent: (e) => (replaying ? queued.push(e) : handlers.onEvent(e)),
        onEnd: (d) => (replaying ? undefined : handlers.onEnd?.(d)),
      };
      const finished = ["done", "failed", "cancelled"].includes(r.run.status);
      if (!finished) r.listeners.add(sub);
      const timers = past.map((e, i) => setTimeout(() => handlers.onEvent(e), 30 + i * pace));
      timers.push(
        setTimeout(
          () => {
            replaying = false;
            for (const e of queued) handlers.onEvent(e);
            if (["done", "failed", "cancelled"].includes(r.run.status)) {
              r.listeners.delete(sub);
              handlers.onEnd?.({ status: r.run.status });
            }
          },
          31 + past.length * pace,
        ),
      );
      return () => {
        for (const t of timers) clearTimeout(t);
        r.listeners.delete(sub);
      };
    },
    async evidence(id) {
      await wait(60);
      const r = runOf(id);
      const seen = revealed(r);
      return clone(r.bundle.evidence.filter((e) => seen.has(e.id)));
    },
    async questions(id) {
      await wait(60);
      const r = runOf(id);
      const seen = revealed(r);
      return clone(r.bundle.questions.filter((q) => seen.has(q.id)));
    },
    async answer(id, req) {
      await wait(250);
      const r = runOf(id);
      for (const a of req.answers) {
        const q = r.bundle.questions.find((x) => x.id === a.questionId);
        if (!q) continue;
        if (a.skip)
          Object.assign(q, {
            skipped: true,
            answeredAt: now(),
            assumption: q.defaultAnswer != null ? `Assumed: ${String(q.defaultAnswer)}` : "Assumed the common case",
          });
        else Object.assign(q, { answer: a.value, answeredAt: now(), skipped: false });
      }
      const open = r.bundle.questions.filter((q) => q.required && !q.answeredAt);
      if (!open.length && r.player?.paused) r.player.resume();
      return clone(r.bundle.questions);
    },
    chat(_id, message, h) {
      const reply = `Mock mode: the engine is not connected, so I cannot reason about "${message.slice(0, 60)}". In live mode this goes to Claude with the run's dossier and evidence.`;
      const words = reply.split(/(?<= )/);
      let i = 0;
      const t = setInterval(() => {
        if (i >= words.length) {
          clearInterval(t);
          h.onDone?.();
          return;
        }
        h.onToken(words[i++]);
      }, 35);
      return () => clearInterval(t);
    },
    async plan(id) {
      await wait(80);
      const r = runOf(id);
      if (!revealed(r).has(r.bundle.plan.id)) throw notFound("plan");
      return clone(r.bundle.plan);
    },
    async patchPlan(id, req) {
      await wait(250);
      const r = runOf(id);
      const p: ChannelPlan = clone(r.bundle.plan);
      const drop = new Map((req.drop ?? []).map((d) => [d.channel, d.reason ?? "Dropped by operator"]));
      if (req.channels)
        for (const c of p.channels) if (!req.channels.includes(c.channel)) drop.set(c.channel, "Dropped by operator");
      const kept = p.channels.filter((c) => !drop.has(c.channel));
      if (req.channels) kept.sort((a, b) => req.channels!.indexOf(a.channel) - req.channels!.indexOf(b.channel));
      p.channels = kept.map((c, i) => ({ ...c, priority: i + 1 }));
      p.notNow = [
        ...p.notNow,
        ...[...drop].map(([channel, reason]) => ({
          channel,
          reason: `${CHANNEL_LABELS[channel]}: ${reason}`,
          evidenceIds: [],
        })),
      ];
      p.version += 1;
      r.bundle.plan = p;
      return clone(p);
    },
    async concepts(id) {
      await wait(80);
      const r = runOf(id);
      const seen = revealed(r);
      return clone(r.bundle.concepts.filter((c) => seen.has(c.id)));
    },
    async regenerateKeyframes(id) {
      await wait(900);
      const { c } = conceptOf(id);
      return clone(c);
    },
    async approveShots(id, idx) {
      await wait(150);
      const { c } = conceptOf(id);
      for (const s of c.shots) if (idx.includes(s.idx)) s.approved = true;
      if (c.shots.length && c.shots.every((s) => s.approved)) c.status = "approved";
      return clone(c);
    },
    async render(id, req) {
      await wait(200);
      const { r, c } = conceptOf(id);
      const est = req.tier === "final" ? c.estimatedCostUsd : Math.round(c.estimatedCostUsd * 25) / 100;
      c.status = "rendering";
      setTimeout(() => {
        c.status = "rendered";
        if (!r.bundle.assets.some((a) => a.conceptId === id && a.kind === "video")) {
          r.bundle.assets.push({
            id: `asset_${id}_video_mock`,
            brandId: c.brandId,
            conceptId: id,
            kind: "video",
            url: MOCK_VIDEO,
            provider: "local",
            costUsd: 0,
            width: 1080,
            height: 1920,
            durationSec: 8,
            demo: true,
            createdAt: now(),
          });
        }
      }, 2500);
      return { concept: clone(c), estimatedCostUsd: est };
    },
    async conceptAssets(id) {
      await wait(60);
      const { r } = conceptOf(id);
      return clone(r.bundle.assets.filter((a) => a.conceptId === id));
    },
    async conceptReviews(id) {
      await wait(60);
      const { r } = conceptOf(id);
      return clone(r.bundle.reviews.filter((v) => v.conceptId === id));
    },
    async blueprints(id) {
      await wait(60);
      const r = runOf(id);
      const seen = revealed(r);
      return clone(r.bundle.blueprints.filter((b) => seen.has(b.id)));
    },
    async blueprint(id) {
      await wait(60);
      for (const r of runs.values()) {
        const bp = r.bundle.blueprints.find((b) => b.id === id);
        if (bp) return clone({ ...bp, evidence: r.bundle.evidence.find((e) => e.id === bp.evidenceId) });
      }
      throw notFound("blueprint");
    },
    async packs(id) {
      await wait(60);
      const r = runOf(id);
      const seen = revealed(r);
      return clone(r.bundle.packs.filter((p) => seen.has(p.id)));
    },
    packDownloadUrl: (id) =>
      `data:text/plain;charset=utf-8,${encodeURIComponent(`Mock mode: pack ${id} is not zipped here. Run in live mode to download the real pack.`)}`,
    async markPosted(id, req) {
      await wait(200);
      const { p } = packOf(id);
      Object.assign(p, { status: "posted", postedUrl: req.postedUrl, postedAt: req.postedAt ?? now() });
      return clone(p);
    },
    async buildLanding() {
      await wait(150);
      throw new ApiRequestError(409, "manus_demo", "Manus runs in demo mode here, so no landing page is built.");
    },
    async addMetrics(id, req) {
      await wait(200);
      packOf(id);
      const { capturedAt, ...m } = req;
      const snap = {
        id: `snap_${id}_${Date.now()}`,
        packId: id,
        capturedAt: capturedAt ?? now(),
        source: "manual",
        ...m,
      } as MetricSnapshot;
      snapshots.set(id, [...(snapshots.get(id) ?? []), snap]);
      return clone(snap);
    },
    async results(id) {
      await wait(80);
      const b = brandOf(id);
      const packs = runsFor(b.id)
        .flatMap((r) => r.bundle.packs)
        .filter((p) => p.status === "posted")
        .map((p) => ({ ...clone(p), snapshots: clone(snapshots.get(p.id) ?? []) }));
      return { packs, learnings: [] };
    },
    async spend() {
      await wait(60);
      return { entries: [], byProvider: {}, totalUsd: 0 };
    },
    async providers() {
      await wait(60);
      return PROVIDER_IDS.map(
        (p): ProviderStatus => ({
          provider: p,
          mode: "demo",
          keyPresent: false,
          verified: false,
          spentUsd: 0,
          label: PROVIDER_INFO[p].label,
          usedFor: PROVIDER_INFO[p].usedFor,
          note: "Mock mode: no provider is called",
        }),
      );
    },
    // A19 in the browser: versions live in memory; a vague first request gets one clarifying question
    async renders(id) {
      await wait(60);
      return clone(versionsOf(id));
    },
    async revise(id, req) {
      await wait(300);
      conceptOf(id); // 404 for an unknown concept, like the engine
      if (!asked.has(id) && req.message.trim().split(/\s+/).length < 4) {
        asked.add(id);
        return {
          status: "needs_clarification",
          question: `What should "${req.message.trim()}" change?`,
          options: ["Only the hook text", "The voice", "The music", "One shot"],
        };
      }
      const list = versionsOf(id);
      const parent = list.find((v) => v.id === req.fromRenderId) ?? list.at(-1)!;
      const plan = {
        layers: ["hook_text" as const],
        summary: `${req.message.trim()} (mock: every clip, the voice and the music reused)`,
      };
      const v: RenderVersion = {
        ...parent,
        id: `render_${id}_${list.length + 1}`,
        version: list.length + 1,
        parentId: parent.id,
        message: req.message,
        plan,
        status: "rendering",
        review: undefined,
        chosen: false,
        costUsd: 0,
        createdAt: now(),
      };
      list.push(v);
      setTimeout(() => {
        v.status = "ready";
        v.assetUrl = MOCK_VIDEO;
      }, 2000);
      return { status: "queued", plan, renderId: v.id };
    },
    async chooseRender(id, renderId) {
      await wait(120);
      const list = versionsOf(id);
      for (const v of list) v.chosen = v.id === renderId;
      return clone(list.find((v) => v.chosen)!);
    },
    async variants(id) {
      await wait(80);
      const { c } = conceptOf(id);
      return {
        shots: c.shots.map((sh) => ({
          idx: sh.idx,
          variants: ["fal", "higgsfield"].map((provider) => ({
            clipId: `clip_${id}_${sh.idx}_${provider}`,
            idx: sh.idx,
            provider,
            url: MOCK_VIDEO,
            chosen: (clips.get(`${id}:${sh.idx}`) ?? `clip_${id}_${sh.idx}_fal`) === `clip_${id}_${sh.idx}_${provider}`,
            costUsd: 0,
          })),
        })),
      };
    },
    async makeVariants() {
      await wait(200);
      return {};
    },
    async chooseClip(id, idx, clipId) {
      await wait(120);
      clips.set(`${id}:${idx}`, clipId);
      return clone(conceptOf(id).c);
    },
  };
  return client;
}

export type { Concept };
