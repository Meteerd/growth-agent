import fs from "node:fs";
import path from "node:path";
import { CHANNEL_LABELS, type DemoRunBundle, SEED_BRANDS } from "@/contracts";
import { logoOnDark } from "@/lib/client/brandAssets";
import { SOURCE_LABELS } from "@/lib/client/format";
import MANUS from "@/lib/client/manus-tasks.json";
import { PURPOSE_LABEL } from "@/lib/client/purpose";

// Server-side only. Everything the landing shows is read from the recorded runs (src/contracts/fixtures/live) and the
// renders in docs/renders and public/showcase. Nothing is typed in by hand, so no number can drift from the data.

const SLUGS = ["hound", "aclinic", "dynova", "evreon"] as const;
const LANGUAGE: Record<string, string> = { en: "English", sk: "Slovak", cs: "Czech", tr: "Turkish", es: "Spanish" };

// read, not imported: scraped ad text can hold lone surrogate escapes that JSON.parse accepts and the bundler rejects
function read(dir: "showcase" | "runs", slug: string): DemoRunBundle | undefined {
  const f = path.resolve("src/contracts/fixtures/live", dir, `${slug}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : undefined;
}

/** A flagship render: served from docs/renders by /renders, poster frame in public/showcase/posters. */
export function flagship(slug: string) {
  const name = `${slug}-flagship`;
  const dir = path.resolve("docs/renders");
  if (!fs.existsSync(path.join(dir, `${name}.mp4`))) return undefined;
  // dubbed versions sit beside the original as <slug>-flagship-<language>.mp4 (Lane A, ElevenLabs Dubbing)
  const dubs = fs.readdirSync(dir).flatMap((f) => {
    const m = f.match(new RegExp(`^${name}-([a-z]{2})\\.mp4$`));
    return m ? [{ lang: m[1], src: `/renders/${f}` }] : [];
  });
  return { src: `/renders/${name}.mp4`, poster: `/showcase/posters/${slug}.jpg`, dubs };
}

/** Short clips Lane A makes for the landing (public/showcase/index.json). Talking clips are AI-generated presenters
 * and say so on the tile. */
export function clips() {
  const f = path.resolve("public/showcase/index.json");
  if (!fs.existsSync(f)) return [];
  type Clip = {
    id: string;
    brand: string;
    label: string;
    aiPresenter?: boolean;
    files: { vertical?: string; poster?: string };
  };
  return (JSON.parse(fs.readFileSync(f, "utf8")) as Clip[]).flatMap((c) =>
    c.files.vertical
      ? [
          {
            id: c.id,
            src: c.files.vertical,
            poster: c.files.poster,
            label: c.label.split(":")[0],
            ai: !!c.aiPresenter,
            note: c.label.split(": ")[1],
          },
        ]
      : [],
  );
}

export function brands() {
  return SLUGS.flatMap((slug) => {
    const b = read("showcase", slug);
    const seed = SEED_BRANDS.find((x) => x.slug === slug);
    const media = flagship(slug);
    if (!b || !seed || !media) return [];
    const c = b.concepts.find((x) => x.blueprintId && !x.variantOf && x.status === "rendered");
    const review = c && b.reviews.filter((r) => r.conceptId === c.id).at(-1);
    const notNow = b.plan?.notNow.find((n) => n.channel === "meta_ads") ?? b.plan?.notNow[0];
    return [
      {
        slug,
        name: seed.name,
        // small copies of the real marks for the landing (public/showcase/logos); the full files are 100x heavier
        logo: fs.existsSync(path.resolve("public/showcase/logos", `${slug}.png`))
          ? `/showcase/logos/${slug}.png`
          : logoOnDark(seed),
        oneLiner: seed.dossier.oneLiner,
        countries: seed.countries,
        runId: b.run.id,
        media,
        title: c?.title,
        language: c ? (LANGUAGE[c.language] ?? c.language) : undefined,
        review: review?.overall,
        channels: (b.plan?.channels ?? [])
          .slice()
          .sort((x, y) => x.priority - y.priority)
          .slice(0, 3)
          .map((x) => ({ label: CHANNEL_LABELS[x.channel], score: x.score })),
        notNow: notNow && { label: CHANNEL_LABELS[notNow.channel], reason: notNow.reason },
      },
    ];
  });
}

// research notes and the brand's own site are evidence, but not competitor ads or posts
const NOT_POSTS = new Set(["manus_research", "website"]);

/** The real numbers: unique real items, dropped off-topic items, winners taken apart, brands, languages, sources. */
export function stats() {
  const items = new Set<string>();
  const sources = new Set<string>();
  const winners = new Set<string>();
  const languages = new Set<string>();
  let dropped = 0;
  for (const slug of SLUGS) {
    const r = read("runs", slug);
    for (const e of r?.evidence ?? [])
      if (!e.demo) {
        sources.add(e.source);
        if (!NOT_POSTS.has(e.source)) items.add(`${slug} ${e.url ?? e.id}`);
      }
    for (const bp of r?.blueprints ?? []) winners.add(bp.evidenceId);
    for (const ev of r?.events ?? []) dropped += Number(ev.title.match(/^Dropped (\d+) off-topic/)?.[1] ?? 0);
    for (const c of read("showcase", slug)?.concepts ?? []) languages.add(c.language);
  }
  return {
    items: items.size,
    found: items.size + dropped,
    sources: sources.size,
    aclinic: read("runs", "aclinic")?.evidence.filter((e) => !e.demo && !NOT_POSTS.has(e.source)).length ?? 0,
    winners: winners.size,
    brands: SLUGS.length,
    languages: [...languages].map((l) => LANGUAGE[l] ?? l),
  };
}

/** A brand's flagship: the winner as its blueprint (beats, numbers, link to the original; we never republish a
 * creator's footage), our remake with its dubs and latest review, and where the plan sends it. */
export function proofFor(slug: string) {
  const b = read("showcase", slug);
  const seed = SEED_BRANDS.find((x) => x.slug === slug);
  const c = b?.concepts.find((x) => x.blueprintId && !x.variantOf && x.status === "rendered");
  const bp = c && b?.blueprints.find((x) => x.id === c.blueprintId);
  const ev = bp && b?.evidence.find((x) => x.id === bp.evidenceId);
  const media = flagship(slug);
  if (!b || !seed || !c || !bp || !ev || !media) return undefined;
  const review = b.reviews.filter((r) => r.conceptId === c.id).at(-1);
  return {
    slug,
    name: seed.name,
    href: `/runs/${b.run.id}/blueprints/${bp.id}`,
    winner: {
      author: ev.author,
      url: ev.url,
      source: SOURCE_LABELS[ev.source],
      kind: ev.kind,
      views: ev.metrics.views,
      outlier: ev.metrics.outlierScore,
      daysRunning: ev.metrics.daysRunning,
      duration: bp.durationSec,
      structure: bp.structure.replaceAll("_", " "),
    },
    beats: bp.shots.map((s) => ({
      purpose: s.purpose,
      label: PURPOSE_LABEL[s.purpose],
      t0: s.t0,
      t1: s.t1,
      what: s.action,
    })),
    remake: {
      ...media,
      // a "dub" in the market's own language is the original; keep only real alternatives
      dubs: media.dubs.filter((d) => d.lang !== c.language),
      title: c.title,
      review: review?.overall,
      shots: c.shots.length,
      language: c.language,
      channel: CHANNEL_LABELS[c.channel],
    },
    channels: (b.plan?.channels ?? [])
      .slice()
      .sort((x, y) => x.priority - y.priority)
      .slice(0, 3)
      .map((x) => ({ label: CHANNEL_LABELS[x.channel], score: x.score })),
    notNow: b.plan?.notNow.slice(0, 2).map((n) => ({ label: CHANNEL_LABELS[n.channel], reason: n.reason })) ?? [],
    research: research(slug, b),
    // the business signal the plan weighed: the offers and prices read from the brand's own site
    offers: seed.dossier.offers.map((o) => (o.price ? `${o.name} ${o.price}` : o.name)).slice(0, 3),
  };
}

/** What the research phase found: real items kept, sources, and Manus's competitors and community rules. */
function research(slug: string, b: DemoRunBundle) {
  const kept = b.evidence.filter((e) => !e.demo && !NOT_POSTS.has(e.source));
  const manus = b.evidence.filter((e) => e.source === "manus_research" && !e.demo);
  const rows = (tag: string) =>
    (manus.find((e) => e.tags?.includes(tag))?.text ?? "").split("\n").filter((l) => /^.+? \(https?:\/\//.test(l))
      .length;
  const extra = (
    MANUS.research as Record<string, { taskUrl: string; competitors?: unknown[]; communities?: unknown[] }>
  )[slug];
  return {
    items: kept.length,
    sources: new Set(kept.map((e) => e.source)).size,
    competitors: rows("competitors") || extra?.competitors?.length || 0,
    communities: rows("communities") || extra?.communities?.length || 0,
    manusUrl: manus.find((e) => e.url)?.url ?? extra?.taskUrl,
  };
}
export const proof = () => proofFor("hound");

/** a.clinic: the paid channel the rule pack refused, and one caption the compliance check sent back. */
export function compliance() {
  const b = read("showcase", "aclinic");
  const refused = b?.plan?.notNow.find((n) => n.channel === "meta_ads");
  const finding = b?.compliance.flatMap((x) => x.findings).find((f) => f.ruleId === "RX2");
  return refused && { refused: refused.reason, finding };
}

/** Lane A's carousel remake for a brand (public/showcase/carousels/<slug>/carousel.json): the format it remakes and
 * its slides. The slide images are AI-generated and say so where they are shown. */
export function carousel(slug: string) {
  const dir = path.resolve("public/showcase/carousels", slug);
  const f = path.join(dir, "carousel.json");
  if (!fs.existsSync(f)) return undefined;
  const c = JSON.parse(fs.readFileSync(f, "utf8")) as {
    language: string;
    pattern?: string;
    why?: string;
    slides: { n: number; role: string; headline: string; png: string }[];
  };
  return {
    language: c.language,
    pattern: c.pattern,
    why: c.why,
    slides: c.slides
      .filter((x) => fs.existsSync(path.join(dir, x.png)))
      .map((x) => ({ n: x.n, role: x.role, headline: x.headline, src: `/showcase/carousels/${slug}/${x.png}` })),
  };
}
