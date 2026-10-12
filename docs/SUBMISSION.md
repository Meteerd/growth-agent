# Submission draft: 10X Your Brand (Slush'D x Manus), 12 Oct 2026

Draft answers for every field of the submission form. Every number below is read from the recorded runs in the repository (`src/contracts/fixtures/live`) or from the task links themselves. Humans fill in what is marked TODO.

## Team name
Team Nexus (the product is called Rekampols). TODO: confirm which name goes on the form.

## One-line description
Rekampols is a go-to-market agent for operators who run many brands: it finds the ads and posts that already win in each brand's market, takes them apart shot by shot, decides where the brand should post, and remakes the winners with the brand's own product, voice and language, checked against its legal rules and handed over ready to post.

## Public GitHub repo
TODO: link after a human creates the public repo from the export (`scripts/export-public.sh ../growth-agent-public`, run at 13:40; secret scan included).

## Live project / demo link
- https://rekampols.xyz (public, read-only showcase of the recorded runs; no API keys on the server)
- Fallback: https://63-181-87-203.sslip.io
- Backup video of the 2-minute demo path: `demo/recordings/pitch-latest.mp4` (on Lane B's laptop; TODO: upload and link if the form asks for a video)

## How we used Manus
Manus is a working part of the engine, called through its REST API v2 (`task.create` with a structured output schema, `task.listMessages`, `website.status`):
1. **Deep research per brand.** At the start of a run, Manus maps the brand's go-to-market landscape in parallel with the other sources: the channels buyers use to discover this kind of product in the brand's markets, the direct competitors and what marketing works for them, and the communities where the problem is discussed with their self-promotion rules, each fact with a source URL. The structured result becomes evidence in the run and is shown in the cockpit's Manus card (landscape, competitors, community rules, link to the task). The direction step reads it with the rest of the evidence (for example, Manus found that r/dogs, r/DogTraining and r/puppy101 ban self-promotion, and Hound's plan keeps Reddit for research only, not posting).
   - Hound: https://manus.im/app/DSvVcvXNJhxXVYymV2dXmd (10 competitors, 6 communities)
   - a.clinic: https://manus.im/app/V88LCYMnD2cFpADzWjjoMU
   - Dynova: https://manus.im/app/eEWu4CdQDEQGnGW9Hm946o (7 competitors)
   - Evreon AI: https://manus.im/app/SSX4iUHYkXZNTAPR868qW6 (8 competitors)
2. **Campaign landing pages.** For each ready-to-post pack, Manus builds a matching landing page in its own workspace (hook, angle, offer, the brand's colours and allowed claims). Rekampols never publishes it; the operator decides.
   - Hound, "Gentle alone-time practice": https://manus.im/app/m8AmRpDsXfA82WupCBzruE
   - a.clinic, "Starostlivosť o váhu bez čakárne": https://manus.im/app/QyuubjsdCietBoxDE9VJhx
   - Dynova Health, "Kişisel verinle karar ver": https://manus.im/app/ELrt8tQJf89VzpgzomDi5X
   - Evreon AI, "Start every consult with the file read": https://manus.im/app/ZcKYphJ7HYprgqT5DXvkA3
   - Earlier Hound pack, "Calm alone time, practiced daily": https://manus.im/app/495LAe3t6NDkJcXULHZL4T

## How we used fal
fal runs Kling image-to-video for the remake shots: each shot of a flagship remake starts from a keyframe (a real brand image or a frame matched to the winner's look) and fal animates it into a moving shot that follows the winner's camera move and timing. Kling 2.1 for the first Hound flagship (6 clips) overnight; Kling 2.5 Turbo Pro for today's re-renders. When fal's balance ran out overnight, the engine fell back to Kling on Higgsfield (Dynova's first flagship). The studio can also fetch alternative takes per shot from fal and Higgsfield and let the operator pick one.

## How we used Apify
Apify's actors collect the winning ads and organic posts: Meta Ad Library, TikTok, Instagram and Reddit. Claude then drops off-topic items before anything is analysed. Items kept from Apify in the recorded research passes:

| Brand | Meta Ad Library | TikTok | Instagram | Reddit | Total |
|---|---|---|---|---|---|
| Hound | 4 | 15 | 23 | 15 | 57 |
| a.clinic | 22 | 25 | 23 | 0 | 70 |
| Dynova | 5 | 19 | 13 | 15 | 52 |
| Evreon AI | 17 | 21 | 23 | 10 | 71 |
| **All four** | **48** | **80** | **82** | **40** | **250** |

Across all sources (Apify, Spiral, YouTube, Manus, the brand's site): 299 real competitor ads and posts kept from 402 found, 12 winning videos taken apart shot by shot.

## Other tools, one line each
- Claude (Anthropic): every decision: research plan, relevance filter, shot-by-shot blueprints, the consultation, channel scores, scripts, the compliance check against each brand's rule pack, and the self-review of every cut.
- ElevenLabs: the cast voice per brand and language, music beds, sound effects, and dubbing (Hound in Spanish).
- Gemini: watches whole videos with sound, the winners and our own cuts, for the review.
- Spiral: Meta and TikTok ad intelligence (winners with transcripts and creative analysis).
- Firecrawl: reads each brand's site into its dossier.
- OpenAI: keyframes and transcription.

## Members
TODO for the humans: name, email, LinkedIn for each member.

## What's next
- Scheduled research refresh (daily or monthly per brand): re-run the market, competitor and winner research, flag new winners and shifts, and update the channel strategy and the remakes automatically (not built for the demo).
