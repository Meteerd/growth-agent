/**
 * pnpm dub <conceptId> <targetLang>
 * A18: ElevenLabs Dubbing of a finished flagship + Scribe word timings + live captions in the new language.
 */
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "elevenlabs";
const { getDb } = await import("@/engine/db/client");
const { dubFlagship } = await import("@/engine/audio/dub");
const r = await dubFlagship(await getDb(), process.argv[2]!, process.argv[3]!);
console.log(
  JSON.stringify({ video: r.asset.url, repoCopy: r.repoCopy, words: r.words, transcript: r.transcript }, null, 2),
);
process.exit(0);
