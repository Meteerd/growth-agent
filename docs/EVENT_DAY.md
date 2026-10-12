# Event day plan (12 Oct, DotsHub). Highest priority list.

## The one thing to fix today: video quality
Hound's flagship is excellent because every shot is a real AI video clip from fal. The others fell back to stills with a shaky ffmpeg zoom after fal's balance ran out at 03:24, with no music and grey caption boxes. Task **A18** in `coord/TASKS_A.md` has the exact fixes. Do it today, in this order:

1. **08:30 check-in**, then claim credits right away: **fal ($50)**, Manus (10,000), Apify. If fal gives a new key, replace `FAL_KEY` in `.env` on Mete's laptop.
2. **Gemini (the video watcher):** get a key at aistudio.google.com (same Google account as the YouTube key) and paste `GEMINI_API_KEY` in `.env`. Gemini watches whole videos with sound: winners (motion, music, pacing) and our own renders (shake, missing music, bad captions).
2b. **ElevenLabs:** paste `ELEVENLABS_API_KEY` in `.env` (music beds + native-language voices).
3. **Go live:** set `LIVE_PROVIDERS=anthropic,openai,firecrawl,youtube,fal,elevenlabs,gemini` (add `apify,manus,spiral` if we run new research). Run `scripts/check-keys.sh`.
4. **09:30 build starts.** Tell Lane A (Mete's agent): "Start A18 now." It fixes, in this order:
   - Motion: real fal clips for every shot; no ffmpeg zoompan on flagships (it shakes); smooth fallback + a shake test.
   - Music: ElevenLabs bed per ad matched to the winner's sound, ducked under the voice, stereo, about -14 LUFS.
   - Voice: ElevenLabs in Slovak, Czech, Turkish, English.
   - Captions: TikTok-native (bold white + outline, phrases timed to the voice, max 2 lines, never over faces, outside the platform UI zones; hook text in the winner's style).
   - Review: watch in motion (~10 fps around cuts), check audio, captions and shake; a shot a viewer would scroll past fails.
   - Re-render a.clinic, Dynova, Evreon flagships; add music to Hound without touching its picture.
5. **Emir:** fix his PC error, `git pull`, make sure the UI shows the new renders as hero media.
6. **13:30 freeze.** No more code changes. Pull on the demo laptop, run `pnpm dev`, walk the demo path in `coord/MORNING_A.md`.
7. **14:30 backup screen recording** of the full demo + two 2-minute pitch rehearsals.
8. **15:00 submissions lock.**

## Remake rule (keep it)
Same winning structure shot for shot (hook mechanism, beats, timing, camera moves, text style), with our brand's product, real images and our own words. Not the competitor's exact script, footage, music or faces: that is a copyright problem and platforms push down duplicate content.

## Show Manus doing real work
The Hound run's Manus deep research (landscape, 10 competitors, community rules) and the Manus-built landing page (`pack_0569d023_1`) are already in the data. Show both in the demo.
