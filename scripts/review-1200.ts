/**
 * pnpm review-1200: coord/REVIEW_1200.md, the beat-by-beat review sheet for Mete (one section per current video).
 * Everything comes from the database and the files on this machine; nothing is invented. Thin customer voice is
 * said out loud.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { probe } = await import("@/engine/media/ffmpeg");
const { urlToFile } = await import("@/engine/video/files");
const db = await getDb();

const VIDEOS = [
  { concept: "concept_1d68be0a_1", file: "docs/renders/hound-flagship.mp4", note: "main (EN-GB, market UK)" },
  { concept: "concept_1e6575ad_1", file: "docs/renders/aclinic-flagship.mp4", note: "main (SK, market Slovakia)" },
  {
    concept: "concept_1e6575ad_1_en",
    file: "docs/renders/aclinic-flagship-en.mp4",
    note: "English version (dub toggle)",
  },
  { concept: "concept_91d09027_1", file: "docs/renders/dynova-flagship.mp4", note: "main (TR, market Turkey)" },
];
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const esc = (s?: string) => (s ?? "").replace(/\|/g, "/").replace(/\n/g, " ").trim();
const out: string[] = [
  "# Review 12:00: beat by beat (for Mete)",
  "",
  "Generated from the engine's data on Lane A's laptop. Reply with notes per beat (e.g. `Hound beat 3: ...`); they are applied in the next round. Product beat = where the real product (site/app/kit) is on screen; CTA = where the call to action lands.",
  "",
];
for (const v of VIDEOS) {
  const c = await repo.getConcept(db, v.concept);
  if (!c) continue;
  const brand = (await repo.getBrand(db, c.brandId))!;
  const bp = c.blueprintId ? await repo.getBlueprint(db, c.blueprintId) : null;
  const ev = bp ? await repo.getEvidence(db, bp.evidenceId).catch(() => null) : null;
  const reviews = await repo.listReviews(db, c.id);
  const rv = reviews.find((r) => r.assetId === c.videoAssetId) ?? reviews.at(-1);
  const file = path.resolve(v.file);
  const dur = fs.existsSync(file) ? (await probe(file)).durationSec : 0;
  const allEv = await repo.listEvidence(db, c.runId);
  const voice = allEv.filter(
    (e) =>
      ["reddit", "trustpilot", "app_store", "play_store", "google_maps"].includes(e.source) ||
      e.kind === "review" ||
      e.kind === "thread",
  );
  out.push(`## ${brand.name}: ${v.note}`);
  out.push("");
  out.push(
    `- File: \`${v.file}\` (${dur ? `${dur.toFixed(1)} s` : "missing on this machine"}), language ${c.language}, channel ${c.channel}, format ${c.format}`,
  );
  out.push(
    `- Review: ${rv ? `${rv.overall}/100, per shot ${rv.perShot.map((p) => p.score).join(" / ")}` : "not reviewed yet"}`,
  );
  out.push(`- Hook: ${esc(c.hook)}`);
  out.push(`- Angle: ${esc(c.angle)}`);
  out.push(`- CTA: ${esc(c.cta)}`);
  if (bp)
    out.push(
      `- Winner it remakes: ${bp.sourceUrl ?? "(no url)"} ${ev ? `by ${ev.author ?? "?"}, metrics ${JSON.stringify(ev.metrics)}` : ""}. Why it wins: ${esc(bp.whyItWins)}`,
    );
  out.push(`- Evidence the concept cites: ${(c.remakesEvidenceIds ?? []).join(", ") || "none"}`);
  out.push(
    `- Customer voice in this brand's research: ${voice.length} items (${[...new Set(voice.map((e) => e.source))].join(", ") || "none"})${voice.length < 5 ? ". THIN: the script leans on the winner and the brand dossier more than on customers' own words." : ""}`,
  );
  out.push("");
  out.push("| # | time | what we see | voice line | on-screen caption | winner beat | product / CTA |");
  out.push("|---|---|---|---|---|---|---|");
  let t = 0;
  for (const s of c.shots) {
    const m = c.shotMap?.find((x) => x.shotIdx === s.idx);
    const b = bp?.shots[m?.blueprintShotIdx ?? s.idx];
    const clip = s.clipAssetId ? await repo.getAsset(db, s.clipAssetId) : null;
    const product =
      s.style === "screen" || (clip?.model ?? "").startsWith("playwright")
        ? "PRODUCT: real site on screen"
        : s.source === "brand_image"
          ? "PRODUCT: real brand image"
          : "";
    const cta = s.idx === c.shots.length - 1 ? `${product ? "; " : ""}CTA spoken + on screen` : "";
    out.push(
      `| ${s.idx + 1} | ${fmt(t)}-${fmt(t + s.durationSec)} | ${esc(s.visualPrompt).slice(0, 110)} (${clip ? `clip: ${clip.provider}` : "still"}) | ${esc(s.voiceover)} | ${s.idx === 0 && s.onScreenText ? `title "${esc(s.onScreenText)}" + ` : ""}spoken words, live | ${b ? `${b.purpose} (${b.t0}-${b.t1}s): ${esc(b.action).slice(0, 90)}` : "-"} | ${product}${cta} |`,
    );
    t += s.durationSec;
  }
  out.push(
    `| end | ${fmt(t)}-${fmt(t + 2)} | animated end card: logo, brand name, CTA pill | - | - | CTA | CTA on screen 2 s |`,
  );
  if (rv) {
    out.push("");
    out.push(`Reviewer notes: ${esc(rv.notes).slice(0, 900)}`);
  }
  out.push("");
}
// talking heads
const idx = path.resolve("public/showcase/index.json");
if (fs.existsSync(idx)) {
  const items = JSON.parse(fs.readFileSync(idx, "utf8")) as {
    id: string;
    kind: string;
    label: string;
    language?: string;
    durationSec: number;
    files: { vertical: string };
  }[];
  out.push("## Talking heads (landing video wall)");
  out.push("");
  out.push("| clip | language | length | file | label |");
  out.push("|---|---|---|---|---|");
  for (const it of items.filter((x) => x.kind === "talking"))
    out.push(
      `| ${it.id} | ${it.language ?? "?"} | ${it.durationSec.toFixed(1)} s | \`public${it.files.vertical}\` | ${esc(it.label)} |`,
    );
  out.push("");
}
const winners = path.resolve("coord/WINNERS_1200.md");
out.push(
  fs.existsSync(winners)
    ? "Old vs new winners: see `coord/WINNERS_1200.md` (re-searched with the stricter bar)."
    : "Old vs new winners: the re-search with the stricter bar is still running; `coord/WINNERS_1200.md` lands next.",
);
fs.writeFileSync(path.resolve("coord/REVIEW_1200.md"), `${out.join("\n")}\n`);
void urlToFile;
console.log("wrote coord/REVIEW_1200.md");
process.exit(0);
