import type { Blueprint, Brand, Evidence, Question } from "@/contracts";
import { longevityTier, winnerRank } from "../research/metrics";

/** Compact evidence lines for prompts (full payloads stay in the DB). Ordered by winner rank. */
export function evidenceDigest(items: Evidence[], max = 45): string {
  return [...items]
    .sort((a, b) => winnerRank(b) - winnerRank(a))
    .slice(0, max)
    .map((e) => {
      const m = e.metrics;
      const nums = [
        m.views !== undefined ? `views ${m.views}` : "",
        m.outlierScore !== undefined ? `outlier ${m.outlierScore}x` : "",
        m.daysRunning !== undefined ? `${m.daysRunning}d running (${longevityTier(m.daysRunning)})` : "",
        m.followers !== undefined ? `followers ${m.followers}` : "",
        m.rating !== undefined ? `rating ${m.rating}` : "",
        m.likes !== undefined && m.views === undefined ? `upvotes/likes ${m.likes}` : "",
        m.comments !== undefined && m.views === undefined ? `comments ${m.comments}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const d = e.deconstruction;
      const dec = d?.hook ? ` | hook: "${d.hook}" | format: ${d.format ?? "?"} | angle: ${d.angle ?? "?"}` : "";
      const text = !dec && e.text ? ` | ${e.text.replace(/\s+/g, " ").slice(0, 220)}` : "";
      return `[${e.id}] ${e.source}/${e.kind}${e.demo ? " (demo)" : ""}: ${e.title}${e.author ? ` by ${e.author}` : ""}${nums ? ` (${nums})` : ""}${dec}${text}`;
    })
    .join("\n");
}

export function blueprintDigest(bps: Blueprint[]): string {
  return bps
    .map(
      (b) =>
        `[${b.id}] from ${b.evidenceId}: ${b.structure}, ${b.durationSec}s, ${b.shots.length} shots, hook (${b.hook.mechanism}): "${b.hook.onScreenText ?? b.hook.spoken ?? b.hook.visual}". Why it wins: ${b.whyItWins}\n` +
        b.shots
          .map(
            (s) =>
              `   ${s.idx}. ${s.t0}-${s.t1}s ${s.purpose} ${s.shotType}: ${s.action}${s.onScreenText ? ` [text: ${s.onScreenText}]` : ""}${s.voiceover ? ` [vo: ${s.voiceover}]` : ""}`,
          )
          .join("\n"),
    )
    .join("\n");
}

export function dossierDigest(b: Brand): string {
  const d = b.dossier;
  return JSON.stringify({
    name: b.name,
    url: b.url,
    vertical: b.vertical,
    countries: b.countries,
    languages: b.languages,
    oneLiner: d.oneLiner,
    positioning: d.positioning,
    offers: d.offers,
    personas: d.personas,
    voice: d.voice,
    proof: d.proof,
    claimsAllowed: d.claimsAllowed,
    claimsForbidden: d.claimsForbidden,
    visual: { colors: d.visual.colors, styleNotes: d.visual.styleNotes },
    gaps: d.gaps,
    operatorAnswers: d.operatorNotes ?? [],
  });
}

export function answersDigest(qs: Question[]): string {
  return qs
    .map(
      (q) =>
        `[${q.id}] ${q.prompt} -> ${q.skipped ? `skipped (assumption: ${q.assumption ?? "none"})` : JSON.stringify(q.answer ?? q.defaultAnswer ?? null)}`,
    )
    .join("\n");
}
