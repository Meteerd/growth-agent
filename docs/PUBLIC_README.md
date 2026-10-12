# Rekampols

A go-to-market agent for operators who run many brands. You enter a brand's site; Rekampols gathers what already wins in that brand's market (competitor ads, organic posts, communities, reviews), takes the winning videos apart shot by shot, asks you only what the data could not answer, decides where the brand should post (and where not yet, with the reason), and remakes the winners with the brand's own product, voice and language. Every script, caption and frame is checked against the brand's legal rules before anything renders. You get ready-to-post packs; nothing is posted or paid for without a human.

Live, read-only showcase of four real brands: https://rekampols.xyz

Built in one day and one night at 10X Your Brand (Slush'D x Manus), Istanbul, 12 Oct 2026.

## The four brands in the showcase
- **Hound** (dog-training app, ES/GB/US): TikTok first; a remake of a myth-vs-fact TikTok that ran at 28.8x its account median, in English with a Spanish dub.
- **a.clinic** (doctor-led weight care, SK/CZ): Slovak remake of a listicle winner; Meta paid ads refused under the rule pack (prescription telehealth needs LegitScript certification), drug names never appear.
- **Dynova** (personal health data, TR): Turkish explainer remake.
- **Evreon AI** (clinic software, HU/GB/DE): LinkedIn first, a founder-style demo clip.

## Where each tool runs (at runtime, not just in the build)
| Tool | What it does in the product |
|---|---|
| Claude (Anthropic) | The brain: research plan, relevance filter, shot-by-shot blueprints of winners, the consultation, channel scores on six axes, scripts, compliance against each brand's rule pack, self-review of every cut. |
| Manus | Deep research per brand (channels, competitors, community self-promotion rules, every fact sourced) and a campaign landing page per pack, through the Manus API v2. |
| Apify | Meta Ad Library, TikTok, Instagram and Reddit scrapers for the winning ads and posts. |
| Spiral | Meta and TikTok ad intelligence: winners with transcripts and creative analysis. |
| Firecrawl | Reads the brand's site into its dossier (offers, claims, colours, fonts). |
| fal | Kling image-to-video for the remake shots (Higgsfield's Kling as the fallback). |
| ElevenLabs | Cast voice per brand and language, music beds, sound effects, dubbing. |
| Gemini | Watches whole videos with sound: the winners, and our own cuts before they ship. |
| OpenAI | Keyframes and transcription. |

## Run it locally
```bash
pnpm install
pnpm dev                 # http://localhost:3000, labelled demo data until you add keys
```
- Keys go in a `.env` you create (variable names in `src/engine/providers/env.ts`). With no keys, every provider runs in demo mode and says so in the UI. A provider makes real calls only when its key is present and it is listed in `LIVE_PROVIDERS`; every paid call goes through a spend ledger with caps.
- The recorded runs of the four brands are seeded into a local SQLite file on the first request.
- Read-only public build: see `deploy/README.md` (`NEXT_PUBLIC_DATA_MODE=showcase`, no keys on the server).

Checks: `pnpm check` (types, lint, unit tests), `pnpm e2e` (Playwright, in-browser mock data), `demo/offline-check.sh` (the demo path with the network refused).

## How it is built
One Next.js app (App Router) with a SQLite database (Drizzle + libsql). The engine (`src/engine`) runs the phases: intake, research, reverse-engineer, consult, direction, production, self-review, compliance, packs. The cockpit UI (`src/app`, `src/components`) streams a run over server-sent events. Video is composed with ffmpeg; the contracts between the two halves live in `src/contracts`.

## Honesty rules the product keeps
- No invented metrics: numbers come from the platforms or from the operator; until then the UI says "Waiting for first metrics".
- Remake, never copy: the structure of a winner is reused; its footage, voice, faces and words are not.
- Demo data is labelled as demo, in the data and in the UI.
