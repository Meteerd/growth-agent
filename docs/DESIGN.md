# Design direction

Owner: Lane B. Update this file with the real tokens once they exist.

## The brief in Mete's words
"Insanely premium. Abstraction over abstraction, the opposite of simple, the opposite of basic." It must not look like a SaaS template, a default shadcn dashboard, or a Tailwind UI clone. Judges see dozens of AI-generated purple-gradient apps tomorrow; ours has to look like an instrument built by a studio.

## Concept: "the observatory"
The product watches markets and decides where a brand should go. The UI is an instrument for that: a dark observatory where evidence floats as matter, channels are bodies in orbit, and the agent's thinking is visible as light moving through layers.

Layers, back to front (this is the "abstraction over abstraction"):
1. **Field:** a full-bleed WebGL shader (domain-warped noise / flow field), very slow, reacts subtly to cursor and to agent activity (it brightens and accelerates while a run is working).
2. **Grid:** hairline measurement grid with coordinates and tick marks, like a plotter or star chart; it scrolls with parallax.
3. **Glass:** translucent panels (backdrop blur, 1px inner border, faint noise grain) that hold content.
4. **Data:** crisp type and numbers on the glass.
5. **Signal:** a single accent color reserved for the agent's live activity and primary actions.

## Tokens (starting point; refine)
- Ink (background): `#06070A`; raised: `#0C0E13`; glass: `rgba(255,255,255,0.04)` with `backdrop-filter: blur(24px) saturate(140%)`.
- Bone (primary text): `#ECE7DD`; secondary: `rgba(236,231,221,0.62)`; tertiary: `rgba(236,231,221,0.38)`.
- Hairline: `rgba(236,231,221,0.08)`.
- Signal accent: one acid tone, e.g. `#D4FF3A`; use sparingly (live states, primary CTA, focus).
- Spectral ramp for the agent "thinking" state and charts: deep violet `#5B3CFF` -> cyan `#3CE0FF` -> signal `#D4FF3A`.
- Status: pass `#7CFFB2`, warn `#FFC85C`, fail `#FF5C7A`. Demo badge: dashed bone outline.
- Radius: 2px for data cells, 14px for glass panels, full for chips. Mixed on purpose.
- Grain: an SVG noise overlay at ~4% opacity over everything.
- Light mode: not needed for the demo. Respect `prefers-reduced-motion` (kill shader motion, keep static gradient).

## Type (free fonts only)
- Display: **Instrument Serif** (big, editorial questions and section titles; italic for emphasis).
- UI: **Inter Tight** or **Geist** (tight tracking, 13 to 15 px UI text).
- Data: **JetBrains Mono** or **Geist Mono** (numbers, ids, timestamps, costs; tabular figures).
- Scale: display 72/96 px on desktop, 40/48 on mobile; micro labels 11 px uppercase mono with +0.08em tracking.

## Signature moments (build these well; they are the demo)
0. **Reverse-engineer view (the most important screen):** the winning ad dissected on a timeline above, our remake aligned shot-for-shot below, a scan line sweeping across while the agent "watches", purposes color-coded, the hook magnified, review scores ticking in. It must make a judge understand the whole product in 10 seconds.
1. **Landing hero:** the field shader with the headline in Instrument Serif; a single URL input that, on submit, "pulls" the field into a vortex and transitions to the run.
2. **Run cockpit:** a vertical phase rail (intake, research, consult, direction, production, compliance, pack) with a moving light; an event stream where each tool call types itself in; evidence cards land on a wall with spring physics, grouped by source, each showing thumbnail, metric and outlier score.
3. **Consultation:** one question at a time, centered, large serif; the "why I'm asking" in small mono under it; evidence chips orbit the question; answers are chips that magnetize to the cursor; a progress constellation (one dot per question) fills in.
4. **Direction:** an orbit map: the brand at the center, channels as bodies at distances inversely proportional to score, sized by priority; hover shows the scores breakdown (six axes) and evidence; the "not now" channels sit outside the orbit, dimmed, with their reason. Also a ranked list view for clarity.
5. **Studio:** storyboard strip of shots (keyframes 9:16), approve per shot with a satisfying check, a cost meter that ticks up in mono, compliance badges, a phone-frame player for the rendered video.
6. **Results:** posted packs with a live counter ("posted 6 h ago, 3,214 views") and a small multiples chart per post; empty state says "Waiting for first metrics" (never fake numbers).

## Motion
- GSAP timelines for orchestrated sequences, Motion for component state, Lenis for smooth scroll.
- Durations 300 to 700 ms, custom ease `cubic-bezier(0.22, 1, 0.36, 1)`; stagger lists 30 to 60 ms.
- Number tickers for every metric that changes. Text reveals by line with mask.
- Cursor: subtle magnetic effect on primary buttons and answer chips only.
- 60 fps target; shader resolution scaled by devicePixelRatio cap 1.5; pause the shader when the tab is hidden.

## References to study (screenshot them with Playwright for the moodboard in `e2e/refs/` (git-ignored is fine))
linear.app, vercel.com, lusion.co, igloo.inc, activetheory.net, rauno.me, family.co, stripe.com/sessions, resend.com, cosmos.so. Take the level of craft, not the layouts.

## Quality bar (check before marking any screen done)
- Looks intentional at 1440x900 and at 390x844 (no horizontal scroll, 16 px gutters on mobile).
- No default component styling visible anywhere (inputs, selects, scrollbars, focus rings all custom).
- Every loading state is designed (skeletons with shimmer on glass, not spinners).
- Every empty state has a sentence and an action.
- Keyboard: tab order sane, visible custom focus, Enter submits.
- Lighthouse performance >= 80 on the landing page in production build.

## Motion plan per screen (Lane B, 11 Oct 23:30)
Timing tiers (from the reference probe in `coord/STATUS_B.md`): **micro** 120 to 160 ms (hover, press, focus), **state** 300 to 450 ms (`--ease-out: cubic-bezier(0.22,1,0.36,1)`), **sequence** 600 to 900 ms (orchestrated, GSAP timeline), **drawer** 420 ms with `cubic-bezier(0.32,0.72,0,1)`. Stagger 40 ms (lists), 60 ms (cards). Every screen renders its static layout server-side first and animates in from it, so there is never a blank frame. `prefers-reduced-motion`: all transforms collapse to a 150 ms opacity fade, the shader freezes on one frame.

| Screen | Entrance | Live motion | Exit / transition |
|---|---|---|---|
| `/` Landing | Field fades up from the static gradient (900 ms). Headline lines rise through a mask, 80 ms apart. Input glass slides up 12 px at +400 ms. | Field drifts at activity 0.15; cursor bends the flow within ~200 px. Primary button is magnetic (max 6 px pull). | Submit: field activity ramps to 1 and the warp centre collapses toward the input (vortex, 700 ms), content scales to 0.96 and fades; route change at 70%. |
| `/brands` Portfolio | Cards rise 16 px + fade, 60 ms stagger, in grid order. View totals tick from 0. | Status dots pulse only for brands with a running run. Hover lifts a card 2 px and brightens its hairline. | Card to brand home: the card's logo and name keep position (shared element, BS3). |
| `/brands/new` Enter | URL input centred, then intake events type in below it, one line per event. | Each crawl event lights a tick on the measurement grid. | When the brand exists, its card assembles from the events and the page moves to brand home. |
| `/brands/[slug]` Brand home | Dossier sections reveal in reading order, 40 ms stagger. | Inline edit: field glass brightens; save shows a 300 ms check, no toast. | |
| `/brands/[slug]/connect` | Tiles fade in by group. | Live tiles carry a slow signal pulse; Demo tiles a dashed outline. | |
| `/runs/[id]` Cockpit | Phase rail draws top to bottom (600 ms), then the stream and wall. | Light travels down the rail to the active phase; completed phases settle to bone. Tool calls type at ~45 chars/s, costs tick. Evidence cards drop onto the wall with a spring (stiffness 260, damping 24), grouped by source. Shader activity follows run state: 0.15 idle, 0.6 running, 0.35 waiting input. | |
| `/runs/[id]/consult` | Question rises through a mask (serif, 600 ms); "why I'm asking" fades at +200 ms; evidence chips settle into orbit around it. | Answer chips are magnetic. Picking one: chip flashes signal, question exits upward, next enters from below (450 ms). Constellation dot fills with a short glow. | All answered: constellation lines connect, then route to the cockpit (run resumes). |
| `/runs/[id]/direction` | Brand core appears, orbits draw as hairline rings, channel bodies slide in along their orbit to their angle (900 ms sequence). Not-now bodies fade in outside the outer ring at 40% opacity. | Hover a body: others dim to 50%, six-axis radar draws in 300 ms. Bodies rotate very slowly (one turn per ~4 min). | List toggle: bodies morph into ranked rows (layout animation). |
| `/runs/[id]/studio` | Concept cards fan in; storyboard frames slide in left to right, 50 ms stagger. | Approve: frame border fills with signal and a check draws (stroke animation, 350 ms). Cost meter ticks up in mono. Render progress fills the phone frame bottom-up. | |
| `/runs/[id]/packs` | Pack cards stack in by platform. | Copy caption: the button text swaps to "Copied" for 1.2 s. Mark posted: the card's status pill morphs from Ready to Posted. | |
| `/brands/[slug]/results` | Small multiples draw their lines left to right (700 ms). | Counters tick when a new snapshot lands. | |
| `/settings` | Rows fade in. | Budget bars fill to their value once (600 ms). | |
