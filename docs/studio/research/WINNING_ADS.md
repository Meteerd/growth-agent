# WINNING_ADS.md: static and carousel ad playbook (Meta + TikTok, 2025-2026)

Purpose: a spec an automated ad generator (LLM + image model) can follow to produce static image ads and carousels for two brands:

- **a.clinic**: doctor-led medical weight-care telehealth, Slovakia + Czechia (EU health rules apply).
- **Hound**: dog-training mobile app (subscription app economics).

Compiled 2026-10-16 from web research. Every factual claim carries a confidence tag:

- **[V]** verified from a primary or official source (platform doc, regulator ruling, platform playbook PDF) or a large first-party dataset with stated method.
- **[S]** secondary: vendor blog, agency blog, practitioner talk recap. Directionally useful, numbers not independently verified.
- **[I]** our inference or recommendation. Not sourced. Test it.

Nothing here is legal advice. a.clinic copy must be reviewed by someone who knows SK/CZ medicine-advertising law before spend.

---

## 0. The 12 rules (read this if nothing else)

1. **A static ad has a hook too.** People scan a static in a fraction of a second; one dominant headline + one focal visual decides the scroll. [S: Alex Cooper]
2. **One idea per ad.** Cover headline ideally 10 words or fewer. [S: Admetrics, Creatorflow]
3. **Write for strangers.** Cold-audience ads also convert warm audiences; the reverse is not true. Never assume brand awareness. [S: Alex Cooper]
4. **Concept diversity beats variant volume on Meta (Andromeda).** Near-duplicate ads collapse into one "entity" and get one shot at retrieval. Test different angles, personas and formats, not button colours. [S: Atria, Jon Loomer; Meta says "creative diversification" is the lever, quoted via Loomer]
5. **Start with 5-10 genuinely distinct concepts per campaign, 2-3 executions each.** [S: Atria, Pilothouse 3x3x3 via secondary]
6. **The formats with the highest hit rates on Meta (Motion, $1.29B spend, Sep 2025-Jan 2026):** Unboxing 9.8%, Offer-First Banner 8.6%, Demo 8.1%, Testimonial 6.5%; Montage, Listicle, Split Screen and Us vs Them also in the 5-10% band. Formats that capture outsized spend: Celebrity 2.1x, Letter ~1.7x, Unconventional Text Placement ~1.5x, Post-It ~1.3x. [V: Motion dataset, own methodology]
7. **Native beats polished on cold traffic.** Heavy branding in the first glance reads as "ad" and gets skipped. [S: Barry Hott talks]
8. **Carousel card 1 must work as a standalone static.** Most users never swipe. [S: multiple]
9. **TikTok carousel ads: vertical 9:16, music required, 3 or 7-9 images, key info inside the safe zone, one caption + one CTA.** [V: TikTok Image Ads Playbook PDF]
10. **a.clinic: no drug names, no "GLP-1", no "injection/jab", no pen imagery, no before/after bodies, no "you" + weight condition, no guaranteed results, no urgency-discount on treatment, landing page must not name drugs either.** [V: ASA/CAP rulings as closest precedent; Meta policy; I: SK/CZ mapping]
11. **Primary text: front-load the first ~125 characters** (visible before "See more"). Headline ~27-40 characters. [S]
12. **Localisation: reserve ~30% extra space for Spanish, ~10% for Czech/Slovak**, and use fonts with full Latin Extended-A (ľ ť ď ř ě ů). [S for %; I for buffer]

---

## 1. Global static-ad anatomy (applies to every format)

### 1.1 Canvas and placement specs

| Placement | Ratio | Pixels | Notes |
|---|---|---|---|
| Meta Feed (FB + IG) | 4:5 | 1080x1350 | Default for statics. [S: Admetrics FAQ] |
| Meta Feed square | 1:1 | 1080x1080 | Also carousel default. [S] |
| Meta Stories / Reels | 9:16 | 1080x1920 | Keep text out of top ~14% and bottom ~35% (UI overlays). [I: commonly cited Meta safe-zone guidance, verify in Ads Manager preview] |
| TikTok image / carousel | 9:16 | 1080x1920 (min 720x1280) | Other ratios may show black bars. Keep text away from bottom caption and right-side buttons. [V: TikTok playbook] |

Generator rule [I]: design master at 9:16 with all critical content in the central 4:5 band so one asset crops to 4:5 and 1:1 safely (Jon Loomer's workaround for Flexible Format). [S]

### 1.2 Visual hierarchy (scan order)

[S: Segwise anatomy, Alex Cooper, Dara Denney Z/F-pattern via Motion panel]

1. **Focal point** (face, product, phone screen, dog) - the first thing the eye hits.
2. **Headline** - largest text, highest contrast, 2-10 words.
3. **Support line / proof** - 1 line, ~40-60% of headline size (subhead, stars, "4.8 from N reviews").
4. **Trust element** near the focal point (doctor name + credential, rating badge, certification).
5. **CTA / offer** last (small button-like pill or arrow). The platform CTA button does most of the work.

Use arrows, highlights, circled words, underlines, text warps to steer the eye. [S: Alex Cooper rule 3]

### 1.3 Text-on-image rules [I unless noted]

- Headline font size: at least ~6% of canvas height (about 80px on 1350px). Readable at thumbnail.
- Max 3 text blocks per static (headline, support, CTA/proof). Exception: text-native formats (Notes, Letter, Reasons Why, Text Wall) where text IS the visual.
- Contrast ratio at least 4.5:1. Avoid thin white text on busy photos. TikTok explicitly warns against "white, vague, too big or too small texts". [V: TikTok playbook]
- No logo larger than ~8% of canvas on cold-traffic ads (anti-"ad smell"). [S: Barry Hott "sniff test" via Motion]
- Numbers beat adjectives ("3 steps", "10 min/day", "4.8 stars") but only real numbers.

### 1.4 Awareness-stage mapping [I, based on Schwartz awareness levels, standard practice]

| Stage | Who | Best formats |
|---|---|---|
| Unaware / problem-aware (cold) | Doesn't know a.clinic or Hound | UGC photo + text, Myth vs Fact, Stat-led, Notes app, PAS, "3 signs" (dog only), Post-it, Anti-ad |
| Solution-aware | Knows options exist | Us vs Them, Reasons Why, Feature stack, How-it-works, Quiz |
| Product-aware (warm/retarget) | Visited site / app store | Testimonial, Founder/Doctor letter, FAQ/objection, Offer card |

---

## 2. Compliance layer (run BEFORE generating copy)

### 2.1 a.clinic (EU medical weight care)

**Platform rules**

- **Meta Health & Wellness:** weight-loss products/services may only target 18+; ads must not imply negative self-perception of body image; no side-by-side weight-loss before/after comparisons; no pinched-fat close-ups. [V: Meta Transparency Center health-and-wellness page, as quoted in search snippets; page body did not render for direct fetch]
  - A blog reports a **22 July 2026** rewrite moving Meta to claim-by-claim review, under which a transformation photo with compliant copy could run. [S: Adligator, NOT verified against Meta]. **Generator default: treat before/after bodies as banned regardless.** [I]
- **Meta Personal Attributes:** ads must not assert or imply personal attributes incl. physical/mental health and medical conditions. "New diabetes treatment available" OK; "Do you have diabetes?" not OK. [V: Meta policy page title + The Markup example]. 2026 blogs say Meta now also flags indirect phrasing like "can't lose weight". [S]
- **Meta Prescription drugs:** promotion only in the US, Canada, New Zealand by LegitScript-certified advertisers targeting 18+. Online pharmacies and telehealth providers must be LegitScript-certified; ads that only educate, or promote telehealth services generally, do not need written authorisation. [V: Meta Drugs & Pharmaceuticals policy, via search snippet] -> **For SK/CZ: never promote a prescription drug. Promote the doctor-led service.** Get LegitScript certification anyway if any ad could be read as an Rx telehealth offer. [I]
- **Meta health data restrictions:** health/weight-loss advertisers may be blocked from optimising for Purchase / Add-to-Cart and from building custom audiences on those events. Reports are mostly US-centric. [S: Pixelflow, Proxima, Click Consult]. Plan tests around upper-funnel or neutrally named custom events (e.g. `consult_booked`). [S/I]
- **TikTok:** weight-management ads 18+ only, healthy-lifestyle framing, no exaggerated or guaranteed results; TikTok said in 2023 it does not permit ads for weight-loss drugs or supplements; 2025 community guidelines restrict before/after content. [S: TikTok policy (JP page), tech.co, STAT; verify current English policy]. **Generator default: TikTok a.clinic ads = lifestyle/education/doctor-access only.** [I]

**Law and regulator precedent**

- EU: Directive 2001/83/EC (Art. 88) bans advertising prescription-only medicines to the general public. [I: general knowledge, not fetched; verify]
- Czechia: Act 40/1995 Coll. on advertising regulation, **§ 5a(2)(a)** prohibits public advertising of prescription-only medicines; SÚKL enforces and fines. [S: ARROWS law-firm commentary]
- Slovakia: Act 147/2001 Coll. on advertising, **§ 8** covers medicines advertising; ŠÚKL supervises; Act 362/2011 on medicines also applies. Exact current wording of the public ban not retrieved. [S: ŠÚKL slides; I: ban exists as EU transposition, verify on slov-lex.sk]
- **UK ASA/CAP is the best published precedent for how regulators read "indirect" promotion** (same EU-derived principle):
  - Joint ASA/MHRA/GPhC Enforcement Notice (Apr 2025, updated Apr + Sep 2025): avoid wording like "weight-loss injection", "obesity treatment jab", "GLP-1"; avoid imagery likely read as an injection pen; avoid general weight-loss ads linking to landing pages that promote POMs. Not naming the drug does not make it compliant. [V: ASA news page]
  - Ads for weight-loss **consultations** are acceptable. [S: Lewis Silkin summary of the notice]
  - Juniper ruling (Apr 2026): influencer ad with "medicated weightloss" + filter landing page that led to Wegovy/Mounjaro listings = promoting POMs; new-mother framing exploited body-image insecurity = socially irresponsible. [V: ASA ruling]
  - Voy (Menwell Ltd): rulings on influencer discount codes / referral links, an Instagram post "A year ago today I was fat", and Black Friday urgency emails naming Wegovy/tirzepatide. [S: AOL/Independent, pharmacy press, ASA rulings list]
  - CAP monitoring Feb 2025-Jan 2026: 95,000+ ads from 44 advertisers captured; ~900 ads from 38 advertisers likely in breach; compliance reached 99% by Jan 2026. [V: CAP Enforcement Report]
- EU consumer law: testimonials/reviews must be genuine; fake or unverified reviews are an unfair practice (Omnibus Directive 2019/2161). [I: general knowledge, verify]
- EU AI Act Art. 50 transparency duties (deepfake disclosure) apply from 2 Aug 2026. Never present an AI-generated person as a real a.clinic doctor or patient. [I: verify]

**a.clinic banned-term list (lint regex, case-insensitive, EN/SK/CZ)** [I, built from the precedent above]

```
wegovy|ozempic|mounjaro|zepbound|saxenda|rybelsus|semaglutid\w*|tirzepatid\w*|liraglutid\w*|
glp-?1|gip|injek\w*|inject\w*|jab|pen\b|pero\b|pero na|shot\b|tablet\w* na chudnutie|
na predpis|na předpis|prescription|rx\b|guarante\w*|garant\w*|zaručen\w*|
\d+\s?kg\s?(za|in|v)\s?\d+|lose \d+|schudnite \d+|zhubněte \d+|
fat\b|tuk\b|tlust\w*|obez\w* (you|vy|ty)|are you overweight|máte nadváhu|trápi vás|
miracle|zázrak\w*|quick fix|rýchlo schudnúť|rychle zhubnout|last chance|posledná šanca|-\d+% (na|on) (liečb|léčb|treatment)
```

**Safe rewrites** [I]

| Do not write | Write instead |
|---|---|
| "Get Wegovy online" / "GLP-1 from 99 €" | "Doctor-led weight care, online" / "First consultation: X €" (service price only) |
| "Are you overweight?" / "Struggling to lose weight?" | "Weight care, led by doctors." / "Weight is biology, not a willpower test." (general statement, no "you" + condition) |
| "Lose 15 kg in 3 months" | "A plan built around your health, not a number." + "Results vary." |
| "The jab that changed my life" | "The doctor who finally listened." |
| Photo of a pen / syringe / pill blister | Doctor at desk, phone video consult, kitchen/walk lifestyle, blood-test report, calendar of check-ins |
| Before/after body split | "What changed": energy, sleep, stairs, habits, check-in timeline (no body comparison) |
| "Black Friday: 40% off treatment" | Do not discount treatment. Offer = consultation access, e.g. "Same-week appointments". |
| New-mother "get your body back" | Never target post-partum / body-image insecurity angles. |

**Landing page rule:** the click destination must not name drugs or show pens either (ASA treats it as part of the ad). [V: ASA Juniper + notice]

### 2.2 Hound (dog-training app)

[I unless noted]

- Real ratings only; quote the store, the number, and the date range. Review quotes must be from real users (EU fake-review rules).
- No "guaranteed" behaviour change; use "in N minutes a day" and "most owners see..." only if backed by in-app data.
- Do not show aversive tools (prong, shock collars) or distressed dogs; positive-reinforcement framing. Animal-welfare complaints get ads reported.
- "Your dog" language is fine (Meta personal-attributes policy is about the viewer's attributes, not their pet). Avoid "Are you a bad dog owner?" (implies a viewer attribute and negative self-perception).
- Don't use competitor logos in Us vs Them; use "Typical training app" / "Private trainer" / "YouTube videos".
- Subscription transparency: if showing a trial, show the post-trial price ("7 days free, then X/yr. Cancel anytime."). The Spotify example in Segwise's anatomy does exactly this. [S]

---

## 3. Format library (structured specs)

Field legend for every format:

- `id`, `name`, `stage` (cold/solution/warm), `evidence`
- `when_to_use`
- `layout` (regions on a 4:5 canvas; top = 0%, bottom = 100%)
- `copy_slots` with **max characters** (English; apply localisation buffer in section 7)
- `visual_prompt` (for an image model)
- `vary_when_testing` (what makes a NEW concept vs a mere variant)
- `compliance` (a.clinic notes)
- `examples` (a.clinic / Hound)

---

### F01 Us vs Them (comparison)

- **stage:** solution-aware. **evidence:** Motion lists Us vs Them in the 5-10% hit-rate band [V]; comparison/"X but for Y" works for subscription apps but over-reliance can reduce perceived originality (Marcus Burke) [S]; telehealth "Comparison Frame" without disparaging alternatives [S: Telehealth Media].
- **when_to_use:** clear, provable differences on 3-5 attributes; category with a known default ("diet apps", "private trainer").
- **layout:** headline band 0-18%. Two columns 20-90%: left "Them" (muted grey, ✗ icons), right "Us" (brand colour, ✓ icons), 3-5 rows. Optional brand chip on "Us" column header. Footer 90-100%: proof line or CTA.
- **copy_slots:**
  - `headline` max 40 ("Weight care that isn't a diet app")
  - `them_label` max 18, `us_label` max 18
  - `rows[3-5]` each max 28 per side
  - `footer` max 50
- **visual_prompt:** flat, high-contrast table; optional small product/phone image at top of "Us" column; no stock-photo people.
- **vary_when_testing:** the "Them" (who you compare to: diet apps / going alone / foreign platform / waiting list for a specialist); the row set (price vs access vs support); persona in headline.
- **compliance:** compare **services**, never drugs. Do not name competitors. No claims you can't substantiate ("cheaper than all").
- **examples:**
  - a.clinic: "Diet app vs a.clinic": "Generic plan / Plan from a doctor", "Chatbot / Real doctors, SK/CZ", "You alone / Regular check-ins", "Calories only / Blood tests + habits".
  - Hound: "Private trainer vs Hound": "60-120 € per session / Less than a coffee a week [only if true]", "Once a week / 10 min every day", "Their schedule / Yours".

### F02 Testimonial / review card

- **stage:** warm and cold. **evidence:** Testimonial 6.5% hit rate, 13.3% of creative, 13.3% of spend [V: Motion]; "static testimonial" (lifestyle or plain image + testimonial headline) is one of 3 core winning static types [S: Alex Cooper]; Social Proof Mashup (multiple reviews) is a tagged format [V: Motion taxonomy].
- **when_to_use:** you have real, specific reviews; objection-handling; retargeting.
- **layout (A, quote-as-headline):** big quote 10-55% in quote marks, 5 stars above it, name + context 58-65%, photo (person or dog) 65-100% or as background with overlay.
  **layout (B, review card):** screenshot-style card (white rounded rectangle) centred, star row, reviewer name, date, platform icon (App Store / Google). Background: soft brand colour or lifestyle photo blurred.
  **layout (C, mashup):** 3-4 stacked short review cards, slightly rotated.
- **copy_slots:** `quote` max 90 (best 40-70, emotional + specific), `attribution` max 40 ("Jana, 46, Bratislava" only with consent), `stars` 1-5, `proof_line` max 40 ("4.8 on App Store, 2,300 ratings").
- **visual_prompt:** natural phone-camera photo, warm light, real environment; for Hound the dog doing the trained behaviour (calm on leash, sitting at door).
- **vary_when_testing:** which objection the quote answers (price / time / trust / "tried before"); speaker persona; layout A vs B vs C.
- **compliance:** real patient, written consent, no weight numbers or body photos, add "Individual results vary." Quote focus: being listened to, energy, routine, ease of process. Never "I lost X kg". No influencer discount codes (Voy/Juniper rulings).
- **examples:** a.clinic: "For the first time a doctor explained why it wasn't my fault." Hound: "Week 2 and Bruno finally walks without pulling."

### F03 Reasons Why (listicle)

- **stage:** solution-aware. **evidence:** Listicle in Motion's 5-10% band [V]; Dara Denney "easy Reasons Why" text-based ads performing across brands 365+ days [S: Aimerce summary]; static works well for listicles because all info is visible at once [S: Nice Ads].
- **when_to_use:** multiple differentiators, none dominant; mid-funnel education.
- **layout:** headline 0-20% ("5 reasons people switch to..."). Numbered list 22-85% (number in brand-colour circle + 3-7 word reason). Optional small hero image right side or bottom 85-100%.
- **copy_slots:** `headline` max 45, `reasons[3-7]` each max 40 (odd numbers 3/5/7 [I]), `footer` max 40.
- **visual_prompt:** clean background, big numerals, optional product/phone mock or doctor photo cut-out.
- **vary_when_testing:** reason count (3 vs 7), the persona in headline ("...women over 45 choose", "...busy dads choose"), the order (lead with the biggest objection).
- **compliance:** each reason must be substantiable. No outcome claims; process/access/support reasons only.
- **examples:** a.clinic "5 reasons patients choose doctor-led weight care": Slovak/Czech doctors / Online, no waiting room / Blood tests included [if true] / Plan adapted every month / Support between visits. Hound "7 reasons dog parents stick with Hound".

### F04 Before/After and its compliant alternatives

- **stage:** cold. **evidence:** Before and After is top-10 by hit rate, "strong across verticals" [V: Motion]. Telehealth: aggressive before/after weight imagery "lost effectiveness", platforms flag it [S: Telehealth Media]. Meta bans weight-loss side-by-sides [V].
- **a.clinic: never use body before/after.** Use one of:
  - **F04a "Old way / New way"**: split screen, left "Old way" (calorie app, scales, guilt notes, crash diet) muted; right "New way" (doctor call, plan, check-in calendar) bright. Headline max 35.
  - **F04b "Journey timeline"**: horizontal timeline Week 1 / Month 1 / Month 3 with non-weight milestones ("first consult", "blood tests reviewed", "plan adjusted"). Max 25 chars per milestone.
  - **F04c "Day vs routine"**: two phone screens: chaotic notes vs structured plan.
- **Hound: dog behaviour before/after is allowed and strong** [I]: split photo "Day 1: chaos at the door" / "Day 14: calm sit". Or a 2-frame leash comparison.
- **layout:** 50/50 vertical split (or top/bottom on 9:16), labels in pills at top of each half, headline band at top or centred across the seam.
- **copy_slots:** `headline` max 35, `label_before` max 16, `label_after` max 16, `footer` max 40 ("Results vary by dog").
- **visual_prompt:** same setting/lighting/angle both halves; only the behaviour/state changes.
- **vary_when_testing:** the problem shown (leash, jumping, barking, potty); time label (Day 3 vs Day 14 vs Week 4).

### F05 Feature callout / benefit stack (Feature Benefit Pointout)

- **stage:** solution-aware. **evidence:** Feature Benefit Pointout is a tagged Motion format [V]; Checkerboard 4-panel grid and app UI screenshots add utility in feed [S: Admetrics, Billo].
- **when_to_use:** product with visual surface (Hound app screens; a.clinic patient app / kit / consult screen).
- **layout:** central hero (phone mockup or doctor photo) 20-85%; 3-4 callout labels with thin leader lines pointing to parts of the hero; headline 0-18%.
- **copy_slots:** `headline` max 40, `callouts[3-4]` max 28 each (benefit, not feature: "Plan adapts every week" not "Adaptive algorithm").
- **visual_prompt:** clean device mockup on soft gradient or real hand holding phone; real app screenshots only (never invented UI that doesn't exist).
- **vary_when_testing:** which feature is the hero; hero type (phone vs person vs dog); callout benefit framing (time vs ease vs results).
- **compliance:** don't show medication screens, dosing, or drug names in UI screenshots.
- **variant F05b Checkerboard:** 2x2 grid alternating text tile / image tile (headline, product, benefit, lifestyle). [S: Admetrics; Dara Denney on grids, S]

### F06 Notes-app screenshot

- **stage:** cold. **evidence:** Notes App is a tagged format [V: Motion taxonomy]; text-wall ads that look organic worked for subscription apps [S: Marcus Burke via RevenueCat]; Dara Denney "founder's letter" and text-native formats [S].
- **when_to_use:** confessional, list-y, "things I wish I knew" content; very low production cost; good for persona hooks.
- **layout:** full-bleed iOS-Notes style: yellow-tinted header, date line, title bold, 4-8 lines of body, maybe checkboxes. No logo, or tiny one at bottom. Optional sticky finger/hand in frame.
- **copy_slots:** `note_title` max 40, `lines[4-8]` max 45 each, `signoff` max 30.
- **visual_prompt:** pixel-faithful generic notes UI (no Apple logo/trademark), realistic status bar, slight screenshot compression.
- **vary_when_testing:** narrator (patient / doctor / dog parent / trainer), list type (mistakes / wins / questions to ask).
- **compliance:** a.clinic: "Questions I wish I'd asked my doctor sooner" is fine; no weight numbers, no drug names. Mark as from a.clinic (no fake persona pretending to be an independent patient). [I]
- **examples:** Hound: "Things that actually stopped puppy biting: ☐ yelping (didn't work) ☑ trading for a toy ☑ 3-min sessions..."

### F07 iMessage / text-message screenshot

- **stage:** cold. **evidence:** Text Message is a tagged format [V: Motion]; social-native mockups reduce ad recognition [S: Admetrics "platform native"].
- **layout:** chat UI, 3-6 bubbles, grey (other) vs blue/brand (self). Last bubble = the punchline/benefit. Optional reaction emoji.
- **copy_slots:** `contact_name` max 16 ("Mom", "Dr. Nováková" only if real and consented), `bubbles[3-6]` max 60 each.
- **vary_when_testing:** who is texting (partner, friend, the dog via humour POV), emotional tone (relief / humour / pride).
- **compliance:** a.clinic: never fake a doctor-patient chat that implies a prescription; frame around booking/process ("Booked my first consult, it was 20 min, no waiting room"). Hound: the dog "texting" the owner is a strong humour hook [I].

### F08 Tweet / Reddit / social-post screenshot

- **stage:** cold. **evidence:** Dara Denney tweet-style and Reddit-style statics [S]; Social Media Mockup and Social Comments are tagged formats [V: Motion].
- **layout:** centred post card on solid background, avatar + handle + post text 1-4 lines, engagement counts. Optional "reply" from brand.
- **copy_slots:** `handle` max 20, `post_text` max 200 (best under 120), `brand_reply` max 100.
- **compliance:** must be a **real** post with permission, or clearly a brand post. Do not fabricate a third-party user post (misleading). [I]

### F09 UGC-style photo with text overlay

- **stage:** cold. **evidence:** UGC Overlay and UGC Selfie are tagged formats [V: Motion]; Barry Hott native/"ugly" ads [S]; Dara Denney "stories-style" casual statics [S]; first-frame screenshots of winning videos as statics [S: Denney].
- **when_to_use:** the default cold-traffic static; best for persona hooks.
- **layout:** full-bleed phone-camera photo; 1-2 text boxes in native IG/TikTok caption style (white rounded box, black text) at 25-45% height; no logo or tiny.
- **copy_slots:** `overlay_1` max 60 (the hook, first person or persona call-out), `overlay_2` max 50 (payoff).
- **visual_prompt:** "candid smartphone photo, natural window light, slightly imperfect framing, real home/park setting, no studio lighting". Hound: owner + dog mid-training with treat. a.clinic: adult 35-60 walking, cooking, on a video call with a doctor (laptop visible).
- **vary_when_testing:** persona (woman 45+, man 40+, shift worker; new puppy owner, rescue dog owner), setting, hook wording.
- **compliance:** no bodies emphasised, no mirror selfies, no measuring tapes, no scales. AI-generated people: allowed only as clearly non-testimonial lifestyle imagery [I]; never caption an AI person as a patient.

### F10 Founder / doctor authority (Letter, Expert Explainer)

- **stage:** cold to warm. **evidence:** Letter has ~1.7x spend use ratio [V: Motion]; Founder's Letter text-only format [S: Denney]; "Quiet Provider Explainer" calm clinician is the top telehealth pattern; "trust now outweighs production value" [S: Telehealth Media].
- **when_to_use:** a.clinic's core moat (real doctors). Hound: certified trainer / founder story.
- **layout A (letter):** paper/letterhead texture, "A note from Dr. [Name], [specialty]" header, 5-9 short lines, handwritten-style signature, small doctor headshot.
  **layout B (portrait + quote):** doctor portrait 0-65% (real photo, white coat optional, clinic or home office), quote band 65-90%, name + credential 90-100%.
- **copy_slots:** `header` max 40, `body_lines[5-9]` max 55 each, `signature` max 30, `credential` max 50 ("Internal medicine, 12 years", only verifiable facts).
- **vary_when_testing:** which doctor/trainer; the belief being reframed ("It's biology, not willpower" / "Why we start with blood tests"); letter vs portrait.
- **compliance:** real, consenting, licensed doctor only; no prescribing promises; no drug talk; credentials must be accurate. This is the safest high-trust a.clinic format. [I]

### F11 Offer / price card (Offer-First Banner)

- **stage:** warm, also cold for apps. **evidence:** Offer-First Banner 8.6% hit rate, 21.9% of creative, 29.3% of spend [V: Motion]; TikTok: "emphasize promotional offers" [V: TikTok playbook]; Spotify-style "1 month free, then X. Cancel anytime." [S: Segwise].
- **layout:** offer in giant type 15-55% ("7 days free" / "First consult 29 €"), product/phone/doctor 55-90%, terms line at bottom (small but legible).
- **copy_slots:** `offer` max 24, `qualifier` max 40, `terms` max 70, `cta_text` max 18.
- **vary_when_testing:** offer type (free trial length, annual discount, free first lesson; for a.clinic: consult price, "this week" availability, free intake call), framing (per day vs per year).
- **compliance:** a.clinic: **price the consultation/service only**; never discount or price medicine; avoid countdown urgency (signals scam, triggers review [S: Telehealth Media]; ASA upheld Voy Black Friday case [S]). Hound: always show post-trial price.

### F12 Myth vs Fact

- **stage:** cold (education). **evidence:** Educational and FAQ formats tagged [V: Motion]; "What I Wish I Knew" educational hook for researching buyers [S: Telehealth Media]; Meta: educational content about medicines/telehealth generally does not need authorisation [V: Meta drugs policy snippet].
- **layout:** two stacked panels: "MYTH" (red/strikethrough) top 15-45%, "FACT" (green/check) 50-85%, source/doctor attribution 88-100%.
- **copy_slots:** `myth` max 60, `fact` max 90, `attribution` max 50.
- **vary_when_testing:** the myth topic; who states the fact (doctor face vs plain).
- **compliance:** facts must be evidence-based and general (e.g., obesity recognised as a chronic disease by WHO/EASO [I: verify wording]); no medication facts; cite source in small print.
- **examples:** a.clinic: Myth "It's just about willpower." Fact "Weight is shaped by hormones, sleep, genetics and stress. That's why a doctor starts with your whole health." Hound: Myth "Old dogs can't learn new tricks." Fact "Dogs learn at any age with short, reward-based sessions."

### F13 Stat-led

- **stage:** cold. **evidence:** Statistic is a tagged format [V: Motion]; social-proof stats like "10M+ players", "4.8★" [S: Segwise].
- **layout:** giant number 15-50% (fills width), 1-line meaning under it, small source line, minimal visual.
- **copy_slots:** `stat` max 10 ("4.8★", "10 min", "3 steps"), `meaning` max 60, `source` max 60.
- **compliance:** only real, sourced numbers. a.clinic: no outcome stats (kg, % weight loss). Use access stats ("Consult within 48 h" if true), or public-health stats with source.

### F14 Problem-Agitate-Solve (Problem Agitation)

- **stage:** cold. **evidence:** Problem Agitation is a tagged format [V: Motion]; TikTok advises opening "demonstrating a problem or a use case that resonates" [V].
- **layout:** 3 bands: Problem (relatable scene/text) 0-35%, Agitate (consequence, 1 line) 35-55%, Solve (brand + mechanism) 55-100%.
- **copy_slots:** `problem` max 45, `agitate` max 50, `solve` max 60.
- **compliance:** a.clinic: agitate the **system** problem (waiting lists, generic advice, yo-yo apps), never the body or the person's self-image. Hound: agitate the situation (ruined walks, chewed shoes), never shame the owner.

### F15 "3 signs..." (signs/checklist)

- **stage:** cold. **evidence:** listicle family [V: Motion band]; persona hooks outperform generic by 30-50% [S: Telehealth Media, unverified].
- **Hound:** "3 signs your puppy is ready for leash training" - fine, strong.
- **a.clinic:** "3 signs you..." about weight is **high risk** (personal attributes). Rewrite as "3 signs a weight plan was built for you, not for everyone" (about the plan) or "3 questions to ask before any weight programme". [I]
- **layout:** headline 0-20%, 3 numbered sign cards 22-85%, CTA/proof 88-100%.
- **copy_slots:** `headline` max 45, `signs[3]` max 45 each, `footer` max 40.

### F16 Quiz-style

- **stage:** cold to solution-aware. **evidence:** Quiz is a tagged format [V: Motion]; Woofz used problem-based surveys built from Google Trends queries ("how to train a puppy to pee outside") [V: Think with Google case study]; no solid data found on quiz-ad performance for subscription apps [gap].
- **layout:** question 0-25%, 3-4 answer buttons (A/B/C/D) 30-80% styled as tappable pills, "Take the 1-min quiz" 85-100%. Carousel variant: one question per card.
- **copy_slots:** `question` max 60, `options[3-4]` max 28 each, `cta` max 30.
- **vary_when_testing:** the question (breed/age/problem; for a.clinic: goals, schedule, "what's held you back" phrased neutrally).
- **compliance:** a.clinic quiz must not ask the viewer to disclose a condition in the ad itself ("What's your BMI?"); keep it about preferences ("What matters most in a weight plan?"). Landing quiz is fine but GDPR health-data consent applies. [I]

### F17 Post-it / sticky note

- **stage:** cold. **evidence:** Post It ~1.3x spend use ratio [V: Motion].
- **layout:** 1-3 sticky notes on a real surface (fridge, laptop, dog crate), handwritten text, photo realism.
- **copy_slots:** `note_text` max 50 per note.
- **examples:** a.clinic fridge note "Doctor call Thu 18:30 ✓". Hound crate note "Sit. Wait. Treat. 5 min x 2".

### F18 Unconventional text placement / Anti-ad / Pattern interrupt

- **stage:** cold. **evidence:** Unconventional Text Placement ~1.5x spend use ratio [V: Motion]; "anti-ad" (bad review, candid admission) for brands with a point of view [S: Admetrics].
- **examples:** text written on a dog's bandana, on a coffee cup, on a clinic door sign; "Our worst review" card with a real 2-star review and a graceful answer.
- **compliance:** a.clinic: keep humour away from bodies and weight.

### F19 App UI / screen mockup (Hound primary)

- **stage:** solution-aware. **evidence:** App Mockup, UI Mockup, Screen Recording tagged [V: Motion]; screenshot sequences/UI mockups add utility in feed [S: Billo]; infographics showing progress work for habit apps [S: Marcus Burke].
- **layout:** one phone, real screen (lesson, progress streak, clicker), 1 headline, 1-2 callouts.
- **copy_slots:** `headline` max 40, `callouts[1-2]` max 28.
- **compliance:** real screens only.

### F20 How it works / process steps

- **stage:** solution-aware and retargeting. **evidence:** "Process Transparency Walk-Through" especially useful to retarget people who started but didn't book [S: Telehealth Media]; How To tagged [V: Motion].
- **layout:** 3 steps vertically or horizontally with icons; step number, 2-5 word title, 1 short line.
- **copy_slots:** `headline` max 40, `steps[3]` title max 24 + line max 50, `footer` max 40.
- **examples:** a.clinic: 1 Short online questionnaire / 2 Video consult with a Slovak doctor / 3 Your plan + regular check-ins. Add "Treatment only if your doctor recommends it." Hound: 1 Tell us about your dog / 2 Get a daily 10-min plan / 3 Track progress.

### F21 FAQ / objection handler

- **stage:** warm. **evidence:** FAQ tagged [V: Motion].
- **layout:** "Q:" bold 0-35%, "A:" 40-85%, doctor/trainer face small.
- **copy_slots:** `question` max 60, `answer` max 140.
- **examples:** a.clinic: "Do I need a referral?" / "Is it covered by insurance?" (only true answers). Hound: "Does it work for older dogs?"

### F22 Trust badge / press / certification

- **stage:** warm. **evidence:** Certification Badge, Press tagged [V: Motion].
- **layout:** product/doctor visual + row of real badges (medical licence, "Doctors registered with SK Medical Chamber" if true, LegitScript if obtained, App Store rating, press logos only if real coverage).
- **compliance:** never invent badges or press.

---

## 4. Carousel blueprints

### 4.1 What differs by surface

| | Meta paid carousel ad | Instagram organic carousel | TikTok photo mode / carousel ad |
|---|---|---|---|
| Card count | 2-10 cards [S] | up to 20 in app; Content Publishing API caps at 10 [S] | ads: 2-35 images; best CTR/CVR at **3 or 7-9** [V] |
| Ratio | 1:1 (also 4:5) [S] | 4:5 or 1:1 | 9:16 [V] |
| Copy | one primary text shared; headline + description + link **per card** [S] | caption; text lives on slides | one caption + one CTA for all images [V] |
| Sound | none | optional | **music required** for ads [V] |
| Ordering | manual, or let Meta auto-order best-first | manual | "Smart Order" auto puts best image first [V] |
| Goal | click/conversion; card 1 = standalone ad | saves + **sends per reach** (Mosseri's top signal) [S] | swipe-through + story; CTA after benefits [V] |
| Swipe mechanics | most users never swipe past card 1 [S] | unswiped carousels may be re-shown starting at slide 2 [S, not confirmed by Instagram] | "tell a continuous story, build anticipation" [V] |

### 4.2 Slide 1 hook patterns (pick one per carousel)

[S: Creatorflow, TikTok playbook, Telehealth Media; I for brand mapping]

1. **Specific claim** - number + subject: "3 steps to calm walks in 14 days" (Hound).
2. **Named mistake** - "The 1 mistake that makes puppy biting worse."
3. **Two states in one frame** - chaos vs calm (Hound only; a.clinic uses old way/new way).
4. **Persona call-out** - "Over 45 and the old advice stopped working?" -> a.clinic must avoid "you" + weight; use "Weight care after 45: what changes" (topic, not viewer attribute). [I]
5. **Myth tease** - "4 weight myths our doctors hear every week."
6. **Curiosity gap with payoff named** - "What a first consult actually looks like (slide 3)."
7. **Contrarian** - "Stop saying 'No!' to your puppy."
8. **Question to the dog's world** - "What your dog is telling you when it yawns."

Cover rules: ~10 words max, one focal point, no paragraphs, visible "swipe" cue (arrow, cut-off element bleeding into slide 2, "1/7" counter). [S: Creatorflow; I for bleed]

### 4.3 Swipe triggers [S/I]

- Slide 2 confirms the payoff is real and says when it arrives. [S]
- Each slide a complete thought (people enter mid-swipe, and IG may start at slide 2). [S]
- Open loops: end slide N with a half-sentence or "but..." completed on N+1. [I]
- Visual continuity: same template, colours, fonts across slides (TikTok explicitly recommends). [V]
- Progress counter "2/7". [I]
- One "sendable" slide (checklist/table/template) at ~60-80% of the deck that works as a standalone screenshot. [S]

### 4.4 Blueprint A: Paid Meta carousel, "Reasons/benefit stack" (5 cards) [I, structure per S sources]

| Card | Role | Copy on image (max) | Card headline (max 40) |
|---|---|---|---|
| 1 | Hook + offer, standalone ad | 8 words | core promise |
| 2 | Key benefit #1 | 10 words | benefit |
| 3 | Supporting feature / how it works | 12 words | feature |
| 4 | Social proof (real review or rating) | quote max 90 chars | "4.8 on App Store" |
| 5 | CTA / offer card | 6 words + terms | "Start free today" |

Primary text (shared): first 125 chars carry hook + benefit + CTA.

### 4.5 Blueprint B: a.clinic "Myth-busting with our doctors" (organic IG 8 slides; paid version = slides 1,2,3,4,6,8)

1. Cover: "4 weight myths our doctors hear every week" + doctor photo.
2. Payoff promise: "Myth #4 is the one that keeps people stuck." + "1/8".
3. Myth 1 vs Fact (F12 template).
4. Myth 2 vs Fact.
5. Myth 3 vs Fact.
6. Myth 4 vs Fact.
7. Sendable: "5 questions to ask any weight programme" checklist.
8. CTA: "Talk to a doctor in Slovak, online. Book a consult." (organic: "Comment PLAN and we'll DM the link" [S: comment-keyword beats bio-link]).

Compliance: no drugs, no bodies, no "you have"; doctor named with real credential; footnote "Educational content. Not a substitute for an individual consultation."

### 4.6 Blueprint C: a.clinic "What happens at a.clinic" process walkthrough (paid retargeting, 5 cards)

1. "What your first month at a.clinic looks like" (calendar visual).
2. Day 1: short online questionnaire (phone UI).
3. Day 2-5: video consult with a doctor (laptop, real doctor).
4. Week 1: blood tests and your plan (lab report visual, no values).
5. Every month: check-ins and adjustments + "Book your consult" + "Treatment only if your doctor recommends it."

### 4.7 Blueprint D: a.clinic "Old way vs doctor-led" comparison (paid, 4 cards)

1. "Diet apps gave you a number. We give you a doctor." (F01 header).
2. Old way: generic calories, no follow-up, chatbot.
3. New way: Slovak/Czech doctors, plan adapted monthly, real follow-ups.
4. Proof + CTA: real patient quote about being listened to + "Results vary."

### 4.8 Blueprint E: Hound "Fix [problem] in [N] days" (TikTok 7 images / IG 8 / Meta 5)

1. Hook: "Puppy biting? Try this 3-step game (day 1 vs day 14)" with split photo.
2. "Why puppies bite (it's normal)" - reassurance (reassurance + solution angle [S: puppy-biting UGC brief]).
3. Step 1 (photo + 1 line).
4. Step 2.
5. Step 3.
6. "Common mistake: yelling 'No!'" (myth/mistake).
7. Sendable: 7-day mini plan table.
8. CTA: "Get your dog's full plan. 7 days free in Hound." + post-trial price line.

TikTok: trending but brand-safe music, 9:16, Smart Order on, CTA "Download".

### 4.9 Blueprint F: Hound "Decode your dog" (organic-first, high share potential)

1. "5 things your dog is telling you (that you're missing)".
2-6. One behaviour per slide (yawn, lip lick, head tilt, zoomies, paw lift) + meaning + 1 tip.
7. Sendable: body-language cheat sheet.
8. CTA: "Hound turns this into daily 10-min lessons."

### 4.10 Blueprint G: Hound feature tour (paid Meta, 4 cards)

1. Real app screen + "A dog trainer in your pocket".
2. Personal plan by breed/age (quiz screen).
3. Built-in clicker + video lessons.
4. Progress streaks + rating + offer.

---

## 5. Creative testing practice (2025-2026)

### 5.1 How Meta delivery works now

- **Andromeda** (Meta's ad-retrieval stage, rolled out from late 2024) narrows a huge eligible-ad pool to a candidate set before ranking; Meta's engineering blog reported a large increase in retrieval model complexity. [S: Atria, Jon Loomer; Meta engineering post Dec 2024 referenced, figures not re-verified here]
- Similar ads are clustered (secondary sources call this an "Entity ID"); 50 cosmetic variants of one hook+offer behave like 1 ad; each distinct concept earns its own retrieval entry. [S: Atria; Pilothouse via launchcodex]
- Meta's own guidance: creative diversification is the best lever to find relevant audiences; use meaningfully different primary texts per ad. [S: Meta quotes via Jon Loomer]
- The old "max 6 ads per ad set" guidance is gone; many advertisers run 10-20+, but more is not automatically better. [S: Loomer]
- A "Creative Similarity" diagnostic in Ads Manager is reported; no official threshold. [S]

**What counts as a new concept (diversity axes)** [S: Loomer, Atria; I for ordering]

1. **Angle / message** (the belief you're selling): doctor authority, process ease, local language, cost vs trainer, dog-parent identity.
2. **Persona** (who it speaks to): woman 45+, man 40+, shift worker; new puppy owner, rescue owner, first-time dog parent.
3. **Format** (from section 3): letter vs UGC photo vs comparison table.
4. **Visual world**: person vs product vs text-only vs dog POV.
5. **Awareness stage**: education vs offer.

Cosmetic changes (colour, one word, CTA button, font) are **variants**, not concepts.

### 5.2 Recommended structure

- **Campaign:** one per conversion objective, broad targeting, Advantage+ placements. [S: Atria]
- **Concepts:** start with **5-10 distinct concepts** per campaign, minimum 5. [S: Atria]
- **Pilothouse 3x3x3:** 3 messaging concepts x 3 formats x 3 hooks = 27 ads for a new product/angle; test concepts first, then expand formats on the winner. Use ABO for concept tests. [S: secondary summaries; no primary Pilothouse doc found]
- **App model (RevenueCat case):** 1 BAU ad set with proven winners + 3 testing ad sets always running new creatives; 30+ creatives tested -> 2-3 winners/week; promote a test ad when CPT <= baseline after 10,000 impressions; pause BAU winner if CPT 20% above baseline over 2 days; kill a test ad with no spend after 2 days. Reported -29% cost per trial. [S: RevenueCat]
- **Read windows:** at least ~1,000 impressions per concept and 5-7 days before calling winners (Atria) [S]; static ads can give directional signal in ~72 h with adequate spend [S: Admetrics]; many ads "die" within the first few hundred impressions [S: Segwise].
- **Refresh:** prospecting creative every 2-3 weeks [S: Atria]; statics fatigue in ~20-30 days vs video 40-60 [S: Segwise citing others].
- **Static vs video mix:** median account in a 67k-ad 2025 analysis ran ~61% static / 39% video [S: Segwise citing Curtis Howland]; under ~$20k/month spend ~70% static is a reasonable start [S]. Subscription apps lean video when demoing features [S]. TikTok claims image ads drive higher early conversion and new-audience reach [V: TikTok playbook, TikTok's own claim]. Recommendation: static + carousel for speed, then turn winning static concepts into video. [I]
- **Placement note for apps:** Facebook Reels/Feed reach older, higher-paying users at low CPM; IG Reels skew younger, lower intent; statics skew to FB feed. Consider separate ad sets by creative type. [S: Marcus Burke]
- **Optimisation event (apps):** StartTrial, ideally fired within 24 h of install. [S: Marcus Burke]

### 5.3 Metrics for statics and carousels

Hook rate / thumbstop (3-s views / impressions) and hold rate are **video** metrics; benchmarks: hook rate ~25-35% solid, 35%+ strong on Meta [S: Motion blog, multiple vendors disagree]. For statics/carousels use:

| Metric | Use |
|---|---|
| CTR (link) and outbound CTR | "Did the static stop and persuade?" Primary early signal. |
| CPC / CPM | Cost efficiency, Meta's quality read. |
| Cost per consult booked (a.clinic) / cost per trial (Hound) | Decision metric. |
| Carousel: card-level clicks, swipe-through (organic: "swipes"), saves, sends per reach | Card order and slide-1 hook. |
| Hit rate (share of ads reaching 10x account-median spend, Motion's definition) | Format/concept portfolio health. |
| Trial-to-paid by cohort (Hound) | Guards against cheap-but-junk trials. |

a.clinic: if Meta's health-data tier blocks lower-funnel optimisation, optimise to a neutrally named custom event and judge creatives on CTR + consult-booking rate from your own backend. [S/I]

### 5.4 Testing matrix recommendation (first sprint)

**a.clinic (SK + CZ, 18+, broad, Advantage+ placements)** [I]

8 concepts x 3 executions = 24 ads, plus 2 carousels.

| # | Angle | Persona | Format A | Format B | Format C |
|---|---|---|---|---|---|
| 1 | Real doctors, your language | general 30-60 | F10 doctor portrait | F09 UGC (video consult on laptop) | F07 text thread "booked in 2 min" |
| 2 | Biology, not willpower | women 45+ | F12 myth/fact | F06 notes "what I wish I knew" | F10 letter |
| 3 | No waiting room | busy professionals | F20 how it works | F17 post-it on laptop | F11 consult price card |
| 4 | Plan beyond the scale (sleep, energy, tests) | men 40+ | F05 feature stack | F04b journey timeline | F03 reasons why |
| 5 | vs diet apps | tried-apps-before | F01 us vs them | F04a old way/new way | F18 anti-ad |
| 6 | Safety and responsibility ("treatment only if right for you") | cautious researchers | F10 letter | F21 FAQ | F22 trust badges |
| 7 | Long-term support | anyone | F02 testimonial (being listened to) | F02c review mashup | F13 stat (access stat) |
| 8 | Local + transparent price | price-sensitive | F11 offer card | F01 local vs foreign platform | F15 "3 questions to ask" |

**Hound (EN/ES, broad, StartTrial)** [I]

| # | Angle | Persona | Format A | Format B | Format C |
|---|---|---|---|---|---|
| 1 | Puppy biting fix | new puppy owner | F04 day 1/day 14 split | F06 notes checklist | Carousel E |
| 2 | Leash pulling | city dog parent | F09 UGC photo | F14 PAS | F15 "3 signs ready for leash" |
| 3 | Trainer in your pocket vs private trainer | cost-aware | F01 us vs them | F11 offer (trial + price) | F13 stat |
| 4 | 10 minutes a day | busy worker | F17 post-it on crate | F20 how it works | F19 app UI |
| 5 | Personal plan by breed/age | first-time owner | F16 quiz | F05 feature stack | Carousel G |
| 6 | Dog-parent identity + humour | Gen Z/millennial | F07 dog "texts" owner | F18 unconventional text (bandana) | F08 tweet-style |
| 7 | Rescue dog confidence | rescue owner | F02 testimonial | F10 trainer letter | F12 myth/fact |
| 8 | Understand your dog | everyone | Carousel F | F03 reasons why | F13 stat |

**Naming convention** [I]: `brand_market_lang_concept##_angle_persona_format_v#` e.g. `aclinic_SK_sk_c02_biology_w45_F12_v1`. Store tags (angle, persona, format, hook type, visual world) so results can be analysed by tag, like Motion/Segwise tagging.

---

## 6. Competitor patterns and angles

### 6.1 Telehealth weight loss

Observed / reported (mostly US/UK; direct Meta Ad Library pulls were not possible in this session):

- **Celebrity and mass media:** Ro: NYC subway/transit ads (2023) and a TV/social campaign with Serena Williams; Hims & Hers: Super Bowl spot. [S: MedicineNet/KFF news] -> Celebrity has the highest spend-use ratio in Motion's data (2.1x) [V]; a.clinic's local equivalent = a respected SK/CZ doctor. [I]
- **Price parity -> marketing and services differentiate:** with drug prices converging, telehealth advantage "will come down to marketing and value-added services". [S: Earnest/eMarketer coverage]
- **Visit model as a differentiator:** Mochi requires a live virtual provider visit; Ro sometimes asynchronous only. [S] -> a.clinic's "real doctor visit" is a positioning asset. [I]
- **Telehealth patterns that work (2026):** Quiet Provider Explainer; Second-Product Story; Process Transparency; Specific Persona Hook; "What I wish I knew"; non-disparaging Comparison Frame. Patterns that stopped working: aggressive before/after, "Are you struggling with X?" hooks, countdown urgency, stock-photo testimonials. [S: Telehealth Media, unverified numbers]
- **Noom:** real customer stories, lifestyle imagery, habit/psychology framing ("Lose weight for good"). [S]
- **UK enforcement shows what competitors tried (and what got banned):** influencer discount codes and referral links (Voy, Zava, MedExpress, UK Meds Direct), new-mother angle (Juniper), "A year ago today I was fat" influencer post (Voy), Black Friday urgency naming drugs (Voy), paid commenters in GLP-1 support groups (Juniper). [V/S: ASA rulings + press]
- **EU-safe angles for a.clinic (synthesis)** [I]: doctor authority; local language and local doctors; process speed/no waiting room; holistic health markers (sleep, energy, blood tests); responsibility/safety; long-term support and check-ins; education (myth/fact, obesity as chronic disease); transparent consult pricing; comparison against diet apps or "going it alone" (not against named clinics).

### 6.2 Dog-training apps

- **Woofz:** found demand via common problem queries in Google Trends, built surveys around them, ran them via broad match; research found millennial and Gen Z owners call themselves "dog parents". Product hooks: personalised plan, step-by-step lessons, built-in clicker, live chat with trainers. [V: Think with Google; app listing]
- **Dogo:** historic SocialPeta snapshot (Mar 2021): ~67% of creatives image ads, ~27% video, Facebook ~40% of impressions. Dated. [S]
- **Pupford:** ~93 active FB ads, mostly video; visible headlines about food and chews ("Skip the Thaw", 50% off starter pack, "Natural fix for destructive chewing"); training is the content wedge, commerce is the offer. [S: AdMake tracker]
- **Subscription-app creative trends:** text-wall statics, progress infographics, faceless AI/B-roll, less talking-head UGC, "X but for Y" comparisons with caution. [S: Marcus Burke]
- **Puppy-biting creative pattern:** reassurance ("biting is a normal stage") + redirection/reward fix. [S: UGC brief]
- **Angles that should work for Hound** [I]: one-problem-per-ad (biting, pulling, barking, potty, recall, separation); 10 min/day; cheaper than a trainer; personalised by breed/age; dog-parent identity and humour (dog POV); positive reinforcement science; progress streaks; free trial with transparent price.
- **Gaps:** no ad-level teardowns found for Dogo, Puppr, ZigZag, GoodPup. Pull from Meta Ad Library (filter by advertiser, country, active) before finalising. The `facebook-ads-library-mcp` repo in `/Users/mete/Desktop/Programs/rekampols-research/repos/` may help. [I]

---

## 7. Copy rules

### 7.1 Meta text fields [S unless noted; verify in Ads Manager preview]

| Field | Visible / recommended | Generator max | Notes |
|---|---|---|---|
| Primary text | ~125 chars before "See more" (some placements ~80) | 125 for line 1; total <= 300 | Hook + benefit + CTA in first 125. Up to 5 primary text options per ad (Meta). Make each meaningfully different. [S: Loomer] |
| Headline | 27 (feed rec.) to 40 | 40 | Reels overlay may show ~10. Up to 5 options. |
| Description | 18-30, often hidden on mobile | 25 | Never put essential info here. |
| Carousel card headline | ~32-45 | 32 | Per card; primary text is shared. |
| On-image headline | n/a | 40 chars / ~8 words (cover); 60 for text-native | [I] |

**CTA buttons:** chosen from a fixed list, depends on objective and format; you cannot type custom button text. Commonly available: Learn More, Sign Up, Book Now, Download, Install Now, Get Offer, Shop Now, Contact Us, Subscribe, Apply Now, Get Quote. [S, list partly unverified]

Recommended [I]:
- a.clinic: **Book Now** (consult), **Learn More** (education/cold), **Sign Up** (questionnaire). Avoid "Shop Now"/"Get Offer" (commerce framing of medical care).
- Hound: **Install Now / Download** (app install), **Sign Up** or **Start Free Trial**-type phrasing in the image when web2app.
- TikTok: one CTA per carousel ad; pick Download / Learn More / Sign Up / Book Now. [V: one CTA rule]

### 7.2 Headline formulas [I, consistent with S sources]

- Specific > clever: "Men's polos for all body types" beats "A men's polo that's made for all body types". [S: Alex Cooper]
- Emotional transformation > product spec; mine long positive reviews for language. [S: Alex Cooper]
- Persona + outcome + mechanism: "Weight care after 45, led by doctors" / "Calm walks in 10 minutes a day".
- Number + noun: "3 steps", "5 reasons", "4 myths".
- Avoid questions that assert a condition (a.clinic). Questions about the dog are fine.

### 7.3 Localisation

| Language | Length vs English | Address form | Notes |
|---|---|---|---|
| Slovak (a.clinic SK) | no data; assume ~+10% [I] | **Vy** (formal, capitalised Vy/Vás in direct address) for medical [I] | EUR: "49 €" with space, decimal comma "49,90 €". Quotes „...“. Diacritics ľ ĺ ŕ ť ď ň ä ô. |
| Czech (a.clinic CZ) | ~+4% to +10% [S] | **Vy** formal for medical [I] | CZK: "1 290 Kč" (space thousands separator). Quotes „...“. ř ě ů ť ď ň. |
| Spanish (Hound ES/LatAm) | ~+15% to +30% [S] | **tú** typical for consumer apps in Spain and LatAm [I] | Opening ¿ ¡ mandatory. Euro after number in Spain "9,99 €"; LatAm currencies vary. |
| English (Hound) | baseline | "you" | Dog-parent vocabulary (Woofz insight). [V] |

Generator rules [I]:
- Write natively in the target language from the brief; do not translate English idioms literally ("game changer", "hack").
- Re-check every char limit **after** localisation; short UI strings expand the most. [S]
- Run the a.clinic banned-term regex on the localised text (SK/CZ terms included).
- Medical terms: use patient-friendly words ("lekár/lékař", "konzultácia/konzultace", "plán starostlivosti/plán péče"), avoid clinical drug vocabulary.
- Hound Spanish: dog breeds and commands may stay in English ("clicker") if that is what the app UI uses.
- Fonts: verify glyph coverage for Latin Extended-A before rendering (Slovak ľ ĺ ŕ, Czech ř ů).

---

## 8. Generator spec (machine-readable brief)

```yaml
ad_brief:
  brand: aclinic | hound
  market: SK | CZ | ES | US | UK
  language: sk | cs | es | en
  platform: meta_feed | meta_story_reels | tiktok | ig_organic
  unit: static | carousel
  format_id: F01..F22 | carousel_blueprint: A..G
  concept:
    angle: "<one sentence belief>"
    persona: "<who>"
    awareness: cold | solution | warm
    hook_type: specific_claim | named_mistake | two_states | persona | myth | curiosity | contrarian
  copy_slots: {}            # keys + max chars from the format spec, post-localisation
  primary_text: {first_125: "", rest: ""}
  headline: ""              # <= 40
  cta_button: Book Now | Learn More | Sign Up | Install Now | Download
  visual_prompt: ""         # style: native phone photo unless format says otherwise
  canvas: {master: 1080x1920, safe_band: 4:5_center}
  compliance:
    banned_regex_pass: true
    no_body_before_after: true
    no_viewer_condition_language: true
    real_people_only_for_testimonials_and_doctors: true
    landing_page_drug_free: true     # a.clinic
    trial_price_shown: true          # hound
    claims_substantiated: [list of claim -> source]
  tags: {angle, persona, format, hook_type, visual_world}
```

**Pre-flight checklist (auto-reject if any fail)** [I]
1. Headline readable at 25% scale.
2. One focal point; at most 3 text blocks (except text-native formats).
3. Character limits respected after localisation.
4. a.clinic: regex clean; no pen/syringe/pill/scale/measuring tape/bare-midriff imagery; no "you" + weight condition; no outcome numbers; "Results vary" where testimonials appear.
5. Every number and review is real and sourced.
6. Concept differs from every other ad in the batch on at least one diversity axis (angle, persona, format, visual world).

---

## 9. Sources

Formats and benchmarks
- Motion, Visual Ad Formats library and 2026 benchmarks (578,750 creatives, 6,015 accounts, $1.29B, Sep 2025-Jan 2026): https://motionapp.com/library/formats/
- Admetrics, Five Static Ad Formats Outperforming Video in 2026: https://www.admetrics.io/post/five-static-ad-formats-outperforming-video-in-2026
- Alex Cooper, 7 Rules for High Converting Static Ads: https://alexcooper.beehiiv.com/p/7-rules-for-high-converting-static-ads
- Segwise, Anatomy of a High-Converting Static Ad: https://segwise.ai/blog/anatomy-high-converting-static-ad.md
- Segwise, Static vs Video Ratio for Meta Ads (67k ads): https://segwise.ai/blog/static-video-ratio-meta-ads
- Aimerce summary of Dara Denney "lazy" Meta ad formulas: https://www.aimerce.ai/topics/dara-denney-lazy-meta-ad-formulas-89
- Motion talk, Dara Denney format win: https://motionapp.com/library/talk/this-one-ad-format-wins-for-dara-denney-s-clients/
- Motion 2025 Facebook ad creative trends panel: https://motionapp.com/library/talk/motion-s-2025-facebook-ad-creative-trends-dtc-expert-lightning-round/
- Barry Hott / ugly ads: https://northbeam.io/post/unleashing-the-power-of-ugly-ads , https://motionapp.com/blog/how-to-start-making-ads , https://www.practicalecommerce.com/ugly-ads-perform-best-marketer-says
- Foreplay ad library format taxonomy: https://www.foreplay.co/adlibrary/formats
- Superads static ad examples: https://www.superads.ai/blog/static-ads-examples

Testing and Andromeda
- Atria, Meta Andromeda update: https://www.tryatria.com/blog/meta-andromeda-update
- Jon Loomer, Andromeda and creative diversification: https://www.jonloomer.com/meta-andromeda-creative-diversification/ , https://www.jonloomer.com/meta-andromeda/
- Pilothouse 3x3x3 (secondary): https://www.adamigo.ai/blog/meta-ad-variations-ai-testing-framework , https://launchcodex.com/?p=3030
- RevenueCat, high-velocity creative testing for apps: https://revenuecat.com/blog/growth/high-velocity-creative-testing-framework-apps-meta
- RevenueCat, Meta ads in 2025 (Marcus Burke): https://www.revenuecat.com/blog/growth/meta-ads-in-2025-tips-for-apps
- Motion, creative metrics (hook/hold rate): https://motionapp.com/blog/key-creative-performance-metrics , https://library.motionapp.com/glossary/thumbstop-rate
- Superads, creative diversity: https://superads.ai/blog/creative-diversity-in-ads

Carousels
- TikTok Image Ads / Carousel Ads Playbook (PDF): https://ads.tiktok.com/business/library/Image_Ads_Carousel_Ads_Playbook.pdf
- Creatorflow, Instagram carousel structure: https://creatorflow.so/blog/instagram-carousel-structure/
- PostNitro, IG carousel 20-slide limit: https://postnitro.ai/blog/post/instagram-carousel-limit-20-photos-per-post-guide
- AdManage, Meta carousel specs: https://admanage.ai/blog/meta-carousel-ad-specs
- RocketShip HQ, carousel ads for mobile apps (vendor claims, unverified): https://www.rocketshiphq.com/carousel-ads-mobile-apps/
- Storrito / Planoly on carousel reach (secondary Mosseri quotes): https://www.planoly.com/blog/instagram-carousels-are-making-a-comeback.md

Health compliance
- Meta Health & Wellness policy: https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness
- Meta Drugs & Pharmaceuticals policy: https://transparency.meta.com/policies/ad-standards/restricted-goods-services/drugs-pharmaceuticals/
- Meta Privacy Violations & Personal Attributes: https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/
- Adligator, Meta health policy update July 2026 (unverified): https://adligator.com/blog/meta-health-wellness-ad-policy-update-2026
- The Markup on Meta sensitive categories: https://themarkup.org/newsletter/citizen-browser/facebook-says-its-dropped-sensitive-ad-targeting-categories
- ASA, updated enforcement notice on weight-loss POM ads: https://www.asa.org.uk/news/updated-enforcement-notice-issued-on-weight-loss-prescription-medicine-ads.html
- CAP Enforcement Report, weight-loss POMs: https://www.asa.org.uk/resource/enforcement-report-weight-loss-prescription-only-medicines.html
- ASA ruling, Juniper Technologies UK: https://www.asa.org.uk/rulings/juniper-technologies-uk-ltd-a25-1319597-juniper-technologies-uk-ltd.html
- ASA rulings, Menwell Ltd (Voy): https://www.asa.org.uk/rulings/menwell-ltd-a25-1321217-menwell-ltd.html
- Lewis Silkin on the enforcement notice: https://www.lewissilkin.com/insights/2025/04/15/asa-injects-an-enforcement-notice-into-the-regulatory-diet-of-ads-for-named-weigh-102k8oe
- Voy discount-code ban coverage: https://www.aol.com/articles/watchdog-bans-social-media-ads-000341759.html
- Czech § 5a(2)(a) Act 40/1995 commentary (ARROWS): https://arws.cz/novinky-v-arrows/jaka-jsou-uskali-reklamy-na-lecive-pripravky
- Slovak drug-advertising supervision (ŠÚKL): https://www.sukl.sk/buxus/docs/O_nas/Vzdelavanie/Dohlad_na_reklamou_liekov.pdf ; Act 147/2001: https://static.slov-lex.sk/pdf/SK/ZZ/2001/147/ZZ_2001_147_20240701.pdf
- Meta health data restrictions (vendor docs): https://docs.pixelflow.so/what-are-meta-s-health-and-wellness-restrictions-and-how-do-they-affect-tracking-ce3t3 , https://www.proxima.ai/article/what-metas-2025-data-restrictions-mean-for-health-and-wellness-brands
- TikTok weight-management policy: https://ads.tiktok.com/help/article/tiktok-ads-policy-weight-management?lang=ja ; STAT on TikTok and weight-loss drugs: https://www.statnews.com/2023/07/19/tiktok-wegovy-ozempic-weight-loss-drugs-obesity/ ; ASA TikTok ban: https://www.marketing-beat.co.uk/2025/12/17/asa-weightloss-ads/

Competitors
- Telehealth Media, best telehealth ads 2026: https://telehealthmedia.com/blog/telehealth-ad-creative/best-ads-telehealth-brands
- Ro / Hims campaigns (news): https://www.medicinenet.com/telehealth_booms_as_demand_for_glp1s_surges/news.htm
- Earnest Analytics, GLP-1 and Hims/Ro growth: https://www.earnestanalytics.com/insights/all-posts/glp-1s-powering-hims-hers-health-ro-sales-growth-in-2024
- Think with Google, Woofz case study: https://business.google.com/en-all/think/future-of-marketing/dog-training-app-awareness/
- SocialPeta, Dogo ad analysis (2021): https://socialpeta.com/competitive-intelligence/dog-training-clicker-by-dogo
- AdMake, Pupford ads tracker: https://www.admakeai.com/advertisers/pupford
- Numan ads (third-party library): https://adlibrary.com/brands/numan-facebook-ads

Copy and localisation
- Meta ad copy character limits (secondary): https://savemyleads.com/blog/other/meta-ads-character-limit , https://adsuploader.com/blog/meta-ad-copy-specs
- Meta CTA options (secondary): https://savemyleads.com/blog/other/meta-ads-cta-button-options
- Text expansion: https://www.linguise.com/blog/guide/why-translated-websites-break-layouts-and-how-to-design-for-text-expansion-from-the-start/ , https://simplelocalize.io/blog/posts/text-expansion-ui-localization/ , https://gameworldobserver.com/?p=231

## 10. Known gaps (do before spending money)

1. Pull live competitor ads from Meta Ad Library (Voy, Juniper, Numan, local SK/CZ clinics; Dogo, Woofz, Puppr, ZigZag, GoodPup). This session could not render the Ad Library.
2. Confirm current Meta Health & Wellness text (the July 2026 change is only reported by a blog).
3. Confirm SK § 8 Act 147/2001 / Act 362/2011 wording and SÚKL/ŠÚKL guidance on "weight-loss service" ads that do not name drugs. UK ASA precedent is a proxy, not SK/CZ law.
4. Confirm whether a.clinic's Meta ad account falls in a health-data restriction tier.
5. Confirm current Meta CTA list per objective in Ads Manager.
