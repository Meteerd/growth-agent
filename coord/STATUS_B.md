# STATUS lane B

## Now
- Time: 2026-10-11 23:23 +03
- Current task: B02 tokens + base layer + /lab
- Last sync: 23:19 exit 0, main UPDATED, checks PASS
- Blockers: none. `@/contracts` not landed yet (Lane A A02); B02 to B04 do not need it.
- Next 3: B02 tokens + base layer -> B03 field shader -> B04 component kit
- Spend so far (USD per provider): 0 (Lane B makes no provider calls)
- ack A01 landed (INBOX_B 23:17). ack real brand assets added (INBOX_B 23:12).

## Design notes (boot, 11 Oct 23:16; measured with a throwaway Playwright probe of computed styles on linear.app, vercel.com, resend.com, rauno.me, igloo.inc)
1. Dark is never pure black: Linear's body is `rgb(8,9,10)`, cool and close to our `#06070A`. Resend uses true `#000` but lifts it with a soft diagonal light beam, so the depth comes from light, not from a grey surface.
2. Display type is tight: Linear sets 72/72 and 64/64 (line-height 1.0) at -0.022em; Vercel goes to -0.06em (64px with -3.84px). For Instrument Serif at 96px we should use line-height about 1.0 and about -0.01em only; serifs crowd faster than grotesks.
3. Resend pairs a serif display (Domaine, 96/96, -0.01em) with a white-to-grey vertical gradient fill on the headline. That serif-plus-gradient move is the closest match to our "observatory" headline. Copy the idea (bone to 62% bone), not the font.
4. UI text lives at 12 to 15 px. Linear's most common sizes are 12, 13, 14 and 15 px, with micro text at 10 px. Body tracking is slightly negative (-0.13 to -0.18 px). Nothing in the chrome is above 16 px. Our 13 to 15 px UI and 11 px mono labels are right.
5. Mono is a second voice, not decoration: Linear uses Berkeley Mono on about 20% of text nodes and Resend uses Commit Mono on about half. Use JetBrains or Geist Mono for every number, id, timestamp, cost and label, at the same visual weight as the sans.
6. Hairlines carry the structure: Linear's dominant border is `1px rgba(255,255,255,0.08)`, with 0.12 for emphasis and 0.05 for quiet. That matches our hairline token. Add a 0.12 "hairline-strong" and a 0.05 "hairline-faint".
7. Panels layer depth with stacked inset shadows rather than a single border: an inset `0 0 0 0.5px rgba(255,255,255,0.08)` plus an inset `0 0 12px rgba(0,0,0,0.2)` plus an outer `0 2px 32px rgba(0,0,0,0.25)`. Our glass panel should do the same: inner light edge, inner falloff, outer lift. Blur is rare: Linear has one `blur(20px)` element (the nav) and Resend a few `blur(25px)` ones. Keep backdrop-filter to 2 or 3 layers per screen and let the shader behind them be the "matter".
8. Micro-interactions are fast and long reveals are slow. Linear: 100 ms (about 240 elements) and 160 ms for hover, 400 to 700 ms for reveals. Vercel: 100 to 150 ms with a few 1 to 1.2 s hero reveals. Plan: hover and press at 120 to 160 ms; state changes at 300 to 450 ms with our `cubic-bezier(0.22,1,0.36,1)`; orchestrated sequences at 600 to 900 ms.
9. Easing: Linear's default is `cubic-bezier(0.25,0.46,0.45,0.94)` and its drawers use `cubic-bezier(0.32,0.72,0,1)`. Vercel and Resend use the Material standard `(0.4,0,0.2,1)`. Our expo-out `(0.22,1,0.36,1)` reads more premium for entrances; add `(0.32,0.72,0,1)` for sheets and drawers.
10. Spacing is dense inside components and generous between them. Gaps are 4, 6 and 8 px inside clusters (Linear about 200 uses, Vercel about 160), then 48 to 64 px between sections, inside a container of about 1250 to 1450 px max. Use a 4 px base with 4/6/8/12/16 for components and 48/64/96/128 for sections.
11. Radius is mixed on purpose: Linear uses full pills for buttons and chips, 8 to 12 px for cards and 4 px for small cells. Resend uses 16 px for cards and pills. This confirms our 2 / 14 / full scheme. Pills get a 1 px gradient border (Resend's announcement pill), a good fit for the demo badge and the live-run chip.
12. Linear's hero was blank 3.5 s after domcontentloaded (content is revealed after load), and igloo.inc rendered nothing in headless Chromium. Lesson for us: a staged reveal must never leave a blank frame or an empty screenshot. Render the static layout first (SSR text plus the static gradient), animate in from it, and give Playwright screenshots a "settled" wait.

## Log (one line per finished task, newest last)
- 23:17 boot: env verified, toolchain ready, lane-b created, first sync exit 0, design notes written.
- 23:22 B01 done (fa070a7): fonts, root layout, Playwright + smoke (1 passed), motion plan in DESIGN.md.
