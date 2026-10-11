---
title: "App Studio (Hound/HuntApp, with Viktor Maric and Emir Sürmen) - call log"
type: project
status: current
last_verified: 2026-09-27
canonical_for: "Chronological record of App Studio / Hound-HuntApp calls with Viktor Maric and Emir Sürmen, sourced from Wispr Flow"
---

# App Studio call log

Compiled from Wispr Flow meeting summaries, 2026-09-27. No existing KB folder was found for "App Studio" as a project (checked `projects/active/`; only related mentions are in `applications/slushd-istanbul-hackathon-2026/`). Partner profiles already exist at `network/profiles/VIKTOR_MARIC.md` and `network/profiles/EMIR_SURMEN.md`. This file is created fresh at `projects/active/app-studio/`.

## State as of the last call (2026-08-31)

- Consumer app studio side venture with Viktor Maric and Emir Sürmen. First product: a dog-training app, "Hound" / "HuntApp".
- Launch approach: skip TestFlight, push straight to production; recruit early testers (~200-300) via Reddit and word of mouth rather than a formal beta.
- Monetization: a web funnel (Paddle payments + Supabase auth) modeled on BetterMe's Calista Nix funnel, plus an in-app paywall modeled on KaleiAI (weekly $10, yearly $59.99, exit-intent 50%-off offer at $29.99). First 100 users get the app free for life as a launch incentive.
- Studio ambition: framed as a repeatable "app studio" playbook (first app slowest, next funnel ~1 day, next app ~1 week), with a planned live test of a reusable marketing system ("Cold Start") at the SlushD Istanbul hackathon (10-16 Oct).
- Equity/incentive structure for the studio was explicitly deferred to an in-person conversation in Budapest, not yet settled.

## Calls

| Date | With | Outcome | Decisions / numbers | Next steps | Wispr link |
|---|---|---|---|---|---|
| 2026-08-21 16:38 | Viktor Maric | Reviewed Hound app progress (85-90% ready) and planned the SlushD Istanbul hackathon, where they'll build "Cold Start", a Manus-driven marketing system to live-test on Hound. | Web funnel needs Paddle payment + Supabase auth, then links to the app account on login. BetterMe cited as funnel template (reportedly $80M/yr bootstrapped). Launch plan: 2-week campaign, ~$2k budget, 15 video + 5 image creatives, target CAC ~$50. | Mete: host Viktor and Emir in Istanbul for SlushD if schedules align. Viktor: check a scheduling conflict, send funnel references. Emir: fix outstanding app issues and send a task list. | https://notes.wisprflow.ai/shared/rx23rtZF9HUtIbz-PVja2XUlBdFDjCPXv09hvXcz7Yw |
| 2026-08-23 11:46 | Viktor Maric [likely] | Planned HuntApp's initial launch: skip TestFlight, push straight to production, recruit ~200-300 early testers via Reddit. | Stay on Netlify (pay for it, ~$10/month) rather than move to Vercel. Emir's company likely fronts infra costs, reimbursed via invoice. Paddle connected on the funnel; add Apple Pay at checkout. | Speaker 1: ask Emir about a TestFlight/production build. Mete: fix Emir's reported bugs, verify Paddle + Apple Pay, post to Reddit once live, test the full funnel-to-app flow first. | https://notes.wisprflow.ai/shared/ghUGyKY0qLAPj5tx4MP1GmC_tPSsIQ_FyFeCnm1pNQk |
| 2026-08-31 17:00 | Emir Sürmen; Viktor Maric | App Studio team reviewed HuntApp's web funnel and aligned on fixes: rebuild checkout as a BetterMe-style overlay, tidy UX copy/images, recruit TestFlight users via Reddit and the office (Deli has a dog), defer Meta Ads and the studio-incentive conversation until an in-person meeting in Budapest. | First 100 users free for life. Checkout rebuilt as a bottom-sheet overlay (not a separate page), hiding the renewing price on Apple Pay. Meta Ads delayed until ~10 users have used the app for a week. Equity/incentive structure deferred to an in-person Budapest meeting. | Viktor: add visuals to main pages, send BetterMe checkout/Apple Pay references, post to TestFlight subreddits (staggered with Emir). Mete: rebuild checkout as an overlay, verify Paddle overlay support, localize pricing by IP, add magic-link login. | https://notes.wisprflow.ai/shared/MHbh-9Ft3mfLGNzbLI30pWebcwAivYDaQpx_yMxT0-I |
| 2026-08-31 17:39 | Viktor Maric | Viktor walked Mete through copying KaleiAI's multi-page paywall for HuntApp: a soft paywall + free-trial flow for the app funnel, and a separate web-funnel path with upsells. | Pricing: $10/week, $59.99/year; exit-intent offer $29.99 (50% off, no trial). First version ships with a soft paywall (easy skip, free week). Introductory pricing applies to the app funnel only, not web funnels; no own models, auth/payments sync via Supabase. | Mete: build the KaleiAI-style paywall with the agreed pricing and exit offer, add upsells to the post-payment web-funnel flow, integrate an MMP to gate Meta Ads traffic behind a hard paywall. | https://notes.wisprflow.ai/shared/K48cH0H1DQKx4w9xfbMGHzDI4udghTzzorpWOhxziL8 |

## Contradictions / notes for orchestrator

- No existing App Studio README/brief exists in the KB to check for contradictions against; this is a net-new project folder.
