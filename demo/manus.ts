// B19a: real Manus tasks on the event credits (authorized by Mete and Emir, 12 Oct): deep research for the brands
// whose recorded research has none (Dynova, Evreon) and a landing page for each flagship pack. Uses the engine's own
// Manus provider through callProvider (spend ledger and caps apply). Never publishes anything: Manus keeps the pages
// unpublished in its workspace. Results go to src/lib/client/manus-tasks.json so every machine shows them offline.
//   pnpm exec tsx demo/manus.ts research dynova evreon
//   pnpm exec tsx demo/manus.ts landing pack_1d68be0a_1 ...
//   pnpm exec tsx demo/manus.ts status        (polls every task; fills results and landing titles)
import fs from "node:fs";
import { loadEnv } from "../scripts/env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "manus";
const OUT = "src/lib/client/manus-tasks.json";

type Task = { taskId: string; taskUrl: string; startedAt: string; state: string; error?: string };
type Research = Task & {
  summary?: string;
  channels?: { channel: string; why: string }[];
  competitors?: { name: string; note: string }[];
  communities?: { name: string; note: string }[];
};
type Landing = Task & { title?: string; publishStatus?: string };
type Store = { research: Record<string, Research>; landings: Record<string, Landing> };

const read = (): Store => {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    return { research: {}, landings: {} };
  }
};
const write = (s: Store) => fs.writeFileSync(OUT, `${JSON.stringify(s, null, 2)}\n`);

const { getDb } = await import("@/engine/db/client");
const manus = await import("@/engine/providers/manus");
const { callProvider } = await import("@/engine/providers/call");
const db = await getDb();
const [cmd, ...args] = process.argv.slice(2);
const store = read();
const url = (t: { task_id: string; task_url?: string }) => t.task_url ?? `https://manus.im/app/${t.task_id}`;

if (cmd === "research") {
  const { getBrand } = await import("@/engine/repo");
  for (const slug of args) {
    if (store.research[slug]) {
      console.log(`${slug}: already started ${store.research[slug].taskUrl}`);
      continue;
    }
    const b = await getBrand(db, slug);
    if (!b) throw new Error(`no brand ${slug}`);
    const out = await callProvider(db, {
      provider: "manus",
      note: `manus deep research: ${slug} (B19a)`,
      estimateUsd: 0,
      demo: () => null,
      live: async () => ({
        result: await manus.createTask(
          manus.landscapePrompt(b.name, b.url, b.dossier.oneLiner, b.countries, b.languages),
          manus.ManusLandscape,
        ),
        usd: 0,
        units: "1 lite task (credits)",
      }),
    });
    if (!out.value) throw new Error("Manus is not live (key missing or cap reached)");
    store.research[slug] = {
      taskId: out.value.task_id,
      taskUrl: url(out.value),
      startedAt: new Date().toISOString(),
      state: "running",
    };
    write(store);
    console.log(`${slug}: research started ${store.research[slug].taskUrl}`);
  }
} else if (cmd === "landing") {
  const { buildLanding } = await import("@/engine/services/landing");
  for (const packId of args) {
    if (store.landings[packId]) {
      console.log(`${packId}: already started ${store.landings[packId].taskUrl}`);
      continue;
    }
    const p = await buildLanding(db, packId);
    const taskUrl = p.landingUrl ?? "";
    store.landings[packId] = {
      taskId: taskUrl.split("/").pop() ?? "",
      taskUrl,
      startedAt: new Date().toISOString(),
      state: "running",
    };
    write(store);
    console.log(`${packId}: landing started ${taskUrl}`);
  }
} else if (cmd === "status") {
  const sentence = (s: string) => (s.match(/^.*?[.;](?=\s|$)/)?.[0] ?? s).trim().replace(/[;.]?$/, ".");
  for (const [slug, r] of Object.entries(store.research)) {
    if (r.state !== "running") continue;
    const s = manus.taskState(await manus.listMessages(r.taskId));
    if (s.state === "running") {
      console.log(`${slug}: running (${s.brief ?? ""})`);
      continue;
    }
    if (s.state === "done" && s.success) {
      const v = manus.ManusLandscape.safeParse(s.value);
      if (v.success) {
        Object.assign(r, {
          state: "done",
          summary: v.data.summary,
          channels: v.data.channels.map((c) => ({ channel: c.channel, why: c.why })),
          competitors: v.data.competitors.map((c) => ({ name: c.name, note: sentence(c.whatWorksForThem) })),
          communities: v.data.communities.map((c) => ({ name: c.name, note: sentence(c.selfPromotionRules) })),
        });
      } else Object.assign(r, { state: "error", error: "unexpected output shape" });
    } else Object.assign(r, { state: s.state, error: s.state === "error" ? s.error : undefined });
    console.log(`${slug}: ${r.state}`);
  }
  for (const [packId, l] of Object.entries(store.landings)) {
    if (l.state === "done" && l.title) continue;
    const s = manus.taskState(await manus.listMessages(l.taskId));
    const site = await manus.websiteStatus(l.taskId).catch(() => null);
    Object.assign(l, {
      state: s.state === "running" ? "running" : s.state,
      title: site?.title ?? l.title,
      publishStatus: site?.publish_status ?? l.publishStatus,
    });
    console.log(`${packId}: ${l.state} ${l.title ?? ""} (${l.publishStatus ?? "no site yet"})`);
  }
  write(store);
} else {
  console.log("usage: research <slug>... | landing <packId>... | status");
}
process.exit(0);
