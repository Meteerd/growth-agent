/**
 * pnpm voices [slug...]
 * A18: cast the ElevenLabs voice per brand and language (library search, 3 candidate takes of the flagship's hook
 * lines, Gemini listens, best kept in assets/voices.json).
 */
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "elevenlabs,gemini";
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { castVoice } = await import("@/engine/audio/choose");
const BRIEFS: Record<string, { concept: string; language: string; accent?: string; gender?: string }[]> = {
  aclinic: [{ concept: "concept_1e6575ad_1", language: "sk", gender: "female" }],
  hound: [{ concept: "concept_1d68be0a_1", language: "en", accent: "british", gender: "female" }],
  dynova: [{ concept: "concept_91d09027_1", language: "tr", gender: "female" }],
  evreon: [{ concept: "concept_f352d515_1", language: "en", accent: "british" }],
};
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BRIEFS);
const db = await getDb();
await Promise.all(
  slugs.map(async (slug) => {
    for (const b of BRIEFS[slug] ?? []) {
      const c = await repo.getConcept(db, b.concept);
      const lines = (c?.shots ?? [])
        .map((s) => s.voiceover ?? "")
        .filter(Boolean)
        .slice(0, 2);
      const v = await castVoice(
        db,
        { slug, language: b.language, accent: b.accent, gender: b.gender, lines, runId: c?.runId },
        path.resolve("data/assets/casting", slug, b.language),
      );
      console.log(
        slug,
        b.language,
        v ? `${v.name} (${v.voiceId}) :: ${v.why} :: ${JSON.stringify(v.candidates)}` : "no voice",
      );
    }
  }),
);
process.exit(0);
