# Lane B review, 12:00 (for Mete)

## Live
- https://rekampols.xyz (fallback https://63-181-87-203.sslip.io). Last deploy I know of: main @ 1aed810 at 11:15 (landing fixes, /results, Plus Jakarta Sans). Everything after it (Lapis re-skin, GTM chain on /results, new posters, roadmap line) is on main and waits for "please deploy" (asked in INBOX_A).
- Read-only showcase: every change is refused with "This is the public showcase ... Live runs happen in the operator app."; no keys on the server.

## The pitch path (presentation mode: `?present=1`, keys 1 to 9, `0` = 2-minute auto-play, Esc stops)
1. `/` How it works: red-graded full-bleed hero made of our four flagship remakes (Hound in colour), "The ads that win, rebuilt for your brand.", URL bar, brand marquee; then the proof (winner taken apart vs our remake, EN/ES toggle), how it works (7 steps), the video wall (flagships + Lane A's talking clips, labelled AI-generated presenters), the stat row (computed from the data), the four brands, the law (a.clinic), built with, CTA.
2. `/results`: per brand, the go-to-market chain (market research incl. Manus -> where to go / not now -> business offers -> the winning ad -> our remake), then the winner taken apart, our remake (market language first, dubs as a toggle), where to go first, not now, latest self-review, link to the side by side.
3. Portfolio, the run (cockpit with the Manus findings brief), reverse-engineer (synced timeline), consult, direction, studio (versions + revise by chat + takes, sound marks), packs (zip, Manus landing page).
Screenshots (desktop, current main, 12:00): `coord/review_b_1200/1-landing.jpg`, `2-results.jpg` (Hound block with the GTM chain), `3-reverse-engineer.jpg`, `4-studio.jpg`.

## Changed since 11:00
- Lapis-style token re-skin (approved): white page, soft warm-grey borderless cards (18 px), softer rules, dark warm primary buttons, muted body text. No layout rewrites.
- /results: the GTM chain row per brand; reviews are the latest exported review of the chosen version (Hound 79, a.clinic 70, Dynova 68, Evreon 81 until your new Evreon review is exported).
- Posters re-cut from your 11:05 and 11:18 renders; the video wall reads `public/showcase/index.json`.
- B19: `docs/SUBMISSION.md` (all fields, real counts, all Manus links), `scripts/export-public.sh` (internal notes excluded, secret + build-notes scans, dry run 577 files clean, never pushes), `docs/PUBLIC_README.md`.
- Landing: one "What's next" line (daily or monthly research refresh).
- Language: every video plays its market language first; alternatives (Hound ES, a.clinic EN, Dynova EN) are toggles; duplicate-language toggles fixed.
- Manus winner hunt (your 11:54 brief, verbatim): Hound https://manus.im/app/fzzYLXm9XTdvKQLjVGF9nX, a.clinic https://manus.im/app/Yawd4sK2jtrGThHN7YroX5, Dynova https://manus.im/app/Nu3dpUd2jy6jMUQw9u4vxx. Results go to coord/WINNERS_MANUS.md as they finish (structured: kind, brand, platform, format, days running, views, URL, why it wins).
- Mock e2e: full run found 17 regressions from the new landing and font (header 17 px too wide at 390, old landing selectors, demo Manus card); all fixed and rerun green (cockpit, strings, direction, blueprint, journey, screens 28/28); e2e/screens refreshed.

## Open questions
1. Team name on the form: "Team Nexus" or "Rekampols"? (SUBMISSION.md marks it TODO.)
2. Members (name, email, LinkedIn) for SUBMISSION.md.
3. Deploy: main has the re-skin and the GTM chain; please deploy when you are happy with it.
5. Carousels on /results: ready to add a slide strip as soon as Lane A's carousel data (paths, slide list) is on main.
4. Stat row says 299 ads and posts kept of 402 found, 12 winners, 3 languages (computed). The earlier brief said 815/13/4; I could not verify those against the data, so they are not on the site.
