# The improvement loop (runs until 07:00, never ends early)

When CORE and STRETCH are done (or blocked), you do NOT stop and you do NOT wait. You run this loop until `date` shows 07:00 or later.

## Rules
- Never idle. Every turn must make at least one tool call that moves the product forward (test, fix, measure, improve). Never answer the goal check with words only.
- Never wait for time to pass: no `sleep` longer than 60 seconds, no "waiting until 07:00". There is always something to improve.
- At least one meaningful commit + `scripts/sync.sh` every 30 minutes.
- Log each loop iteration as one line in your STATUS file: what you tested, what you found, what you fixed, commit hash.
- Add every self-found issue as a task under a `## IMPROVE (self-generated)` section at the bottom of your TASKS file (`- [ ] Ixx title` + acceptance), then fix it and check it off. This keeps a visible record.
- Never break main: `pnpm check` (and for Lane B the mock e2e) must pass before every sync to main.

## The loop
1. `scripts/sync.sh <lane>`; handle inbox messages.
2. Exercise the whole product the way a judge would: Lane A runs a full GTM run for all four brands (demo, plus the recorded live data for Hound and a.clinic) and reads the outputs; Lane B clicks through every screen with Playwright in mock and live mode, desktop and mobile, and looks at the screenshots.
3. Find the weakest thing: a failing or flaky test, an uncovered edge case below, a slow step, an ugly or unclear screen, a weak or ungrounded agent output, a console error, a confusing sentence.
4. Write it as an IMPROVE task, fix it, add a test that would have caught it, run `pnpm check`, sync.
5. Go to 1.

## Edge cases to cover (pick unchecked ones; add more as you find them)
### Lane A (engine)
- Brand URL invalid, unreachable, slow (timeout), redirecting, robots-blocked, non-English (Slovak, Czech, Turkish, Spanish), very large site.
- Provider errors: 401, 429, 5xx, timeouts, malformed JSON, empty results; retries with backoff; fall back to demo with a warning event.
- Budget cap reached mid-run: the run continues in demo for that step, and the UI gets a clear warning event.
- Zero winning videos found; only static ads found; video download fails; corrupted media; no audio track; very long video (> 3 min); horizontal video; transcript empty; frames all near-identical.
- Claude refusal, max_tokens stop, invalid structured output: retry once, then fail the step gracefully with a reason.
- Run cancelled mid-phase; server restarted mid-run (resume or mark failed cleanly); two runs at once for the same brand; SSE client reconnects with Last-Event-ID; duplicate or late answers; all questions skipped.
- Compliance still failing after 2 revisions: block export with a clear explanation.
- Render failure; missing keyframe; missing brand assets; Unicode (ç ş ğ ı ö ü, č ž š ľ ť ď ň) in captions and filenames.
- Output quality: every claim in dossier, plan and concepts cites evidence or an answer; blueprints have correct timings; remakes keep the hook mechanism; a.clinic never names Rx drugs; Evreon never gets TikTok as top channel. Write small eval scripts for these and improve prompts until they pass.
### Lane B (cockpit)
- Every screen at 390, 768, 1440 width: no overflow, no horizontal scroll, readable type.
- Loading, empty and error states on every screen; API down; slow network (Playwright throttling); SSE drops and reconnects.
- Long strings (Slovak, Czech, Turkish text, long brand names, long captions) do not break layouts.
- Missing images or frames (third-party frames exist only on the analyzing machine): styled placeholders.
- Keyboard-only navigation, focus order, visible focus, labels, contrast on glass; `prefers-reduced-motion`.
- Zero console errors and warnings on every route; 404 page; error boundary; double-submit protection; back/forward and deep links work.
- Mock vs live parity: every screen works against the real API routes with real seeded data.
- Performance: shader frame time, Lighthouse on the landing page, no layout shift on load.
- Copy pass: no em dashes, no AI filler, plain specific sentences.
- Visual audit against docs/DESIGN.md quality bar using the committed screenshots; fix the ugliest thing first. The reverse-engineer view gets the most polish.
