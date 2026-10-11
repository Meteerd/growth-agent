# Brands (seed data) and rule packs

Dossiers v0 below were drafted on 11 Oct 2026 from the live websites. They are the seed for `pnpm seed`. The agent's own intake run will refine them; never overwrite operator edits with crawled guesses.
Rule packs were drafted from research on 11 Oct 2026 (sources at the bottom). **They are guardrails, not legal advice.** Mark any rule you cannot source as `verify: true`.

---

## 1. a.clinic
- URL: https://a.clinic (also `/sk/`, `/cz/` paths)
- Vertical: `telehealth_rx` · Countries: SK, CZ · Languages: sk, cs, en
- One-liner: Doctor-led online weight care in Slovakia and Czechia.
- How it works: ~10-minute online medical questionnaire, video consultation with a licensed doctor, a prescription (ePredpis in SK) if the doctor decides it is appropriate, ongoing check-ins with a care team; medicine is paid at the pharmacy.
- Cities on site: Bratislava, Košice, Žilina, Praha, Brno.
- Positioning: "Weight loss, done properly": medical oversight over quick fixes. Calm, reassuring, clinical yet approachable.
- Proof on site: licensed doctors, official prescriptions, doctor-reviewed, full price shown before payment, cancel anytime. Gaps: no testimonials, outcomes, doctor credentials or visible prices.
- CTAs: "Start today", "How it works". B2B: "For doctors" partnership.
- Rule pack: `eu_rx_telehealth`

## 2. Hound
- URL: https://houndapp.xyz · Company base: Istanbul
- Vertical: `consumer_app` · Countries (initial): ES, GB, US (Spain-first GTM research from Aug 2026; site copy is English) · Languages: en, es
- One-liner: A daily behavior plan built for your dog.
- Product: personalized 12 to 52 week plan, one short exercise a day (~10 min), progress and streaks; problems: separation anxiety, barking, destruction, pulling on lead, reactivity, extra weight. Methods: desensitization and counter-conditioning. Age-based onboarding quiz (puppy, adolescent, adult, senior) that every CTA routes to.
- Pricing (from App Studio notes, verify on site): weekly $10, yearly $59.99, exit-intent $29.99; web funnel with Paddle.
- Gaps: no pricing on page, no reviews, no app store badges, no social links.
- Disclaimer on site: not veterinary advice.
- Rule pack: `consumer_app_pet`

## 3. Dynova
- URL: https://dynova.health · Instagram: @dynovahealth
- Vertical: `health_wellness_dtc` · Countries: TR · Languages: tr, en
- One-liner: Personal health decisions based on your own data.
- Lines: Dynova Health (at-home genetic test, reports on nutrition, healthy aging, performance, skin, drug response; doctors and dietitians), Dynova Nutrition (personalized monthly vitamins/supplements, made in USA), Dynova Beauty (face-photo skin analysis across 11 areas + routine).
- Proof: team credentials (MDs, Harvard visiting AI researcher). Gaps: no testimonials, studies, certifications, customer numbers; tiers ("Prestige") unexplained.
- Site disclaimer: reports are informational and do not replace medical diagnosis or treatment.
- Rule pack: `tr_health_wellness`

## 4. Evreon AI
- URL: https://evreonai.com · Offices: Budapest, London · Live in the EU
- Vertical: `b2b_saas` · Countries: EU (HU, GB, DE first) · Languages: en
- One-liner: An agentic operating system for clinics.
- Agents: reception (scheduling, booking), intake (pre-visit history in the patient's language), records (reads/files scanned or foreign-language documents with source links), billing; scribe coming.
- Positioning: less paperwork; every output traceable to its source; never makes diagnoses ("0 diagnoses made. By design."). Buyers: private practices first, then multi-doctor clinics, then hospitals.
- Proof: peer-reviewed paper, physician advisers, EU data residency, 50+ languages. Gaps: no pricing, logos or case studies.
- CTA: "Book a demo" (20 minutes).
- Expected direction: LinkedIn + founder-led content + outbound + communities of practice managers; not TikTok.
- Rule pack: `b2b_healthtech`

---

## Rule packs

Each rule: `id`, `severity` (`block` | `warn`), text, `source`, `verify` flag. Store in `apps/engine/rules/<pack>.md`.

### `common` (applies to every pack)
- C1 block: no fabricated statistics, testimonials, reviews, user counts or results.
- C2 block: no copying another brand's creative, script, music or footage; remakes must be original.
- C3 block: no fake scarcity or fake urgency ("only 3 spots left") unless true and provided by the operator.
- C4 warn: AI-generated people must not be presented as real customers or real doctors; label as dramatization where required by platform.
- C5 warn: platform disclosure rules for AI-generated content (TikTok and Meta AI labels) must be followed at posting time (add to pack checklist).

### `eu_rx_telehealth` (a.clinic)
- RX1 block: never name or show prescription-only medicines or their brands/molecules in consumer-facing content (e.g. Wegovy, Ozempic, Mounjaro, Zepbound, Saxenda, semaglutide, tirzepatide, liraglutide, "GLP-1 injections" as a product). Source: SK total ban on advertising prescription medicines; CZ: advertising to the public must not involve prescription-only medicines (SÚKL fines CZK 200,000 to 350,000).
- RX2 block: never imply that a consultation with a doctor or a medical examination is unnecessary, or promise a diagnosis or treatment remotely as a sales hook. Source: CZ rules on advertising that gives the impression a consultation is unnecessary, in particular by offering diagnosis or distance treatment.
- RX3 block: no promised outcomes (kg lost, timeframes), no before/after imagery, no body-shaming or negative self-image framing. Sources: Meta personal health and appearance policy; LegitScript disapproval reasons.
- RX4 block (paid only): Meta/Instagram paid ads promoting prescription telehealth require LegitScript certification + Meta authorization; target 18+ only, eligible countries only. Until certified, `meta_ads` goes to `notNow` for this brand. Source: Meta Drugs and Pharmaceuticals ad standard.
- RX5 warn: allowed angles: doctor-led care, convenience (no clinic visit, local pharmacy), transparency (full price before paying), support and follow-up, education about weight as a health topic without products.
- RX6 warn: show real doctors only with their written consent; otherwise no doctor faces or a clearly fictional dramatization label. `verify: true`.

### `consumer_app_pet` (Hound)
- P1 block: no veterinary or medical claims; behavior outcomes framed as "help", "practice", "progress", never guarantees.
- P2 block: no depiction of animal distress, harm or punishment-based training.
- P3 warn: separation anxiety severe cases: suggest a vet or qualified behaviorist (mirrors site disclaimer).
- P4 warn: subscription terms and trial conditions must be accurate if mentioned.

### `tr_health_wellness` (Dynova)
- T1 block: no diagnosis, treatment, cure or disease-prevention claims for genetic reports, supplements or skin analysis. Reports are informational.
- T2 block: supplements: no claims that they treat, cure or prevent disease; no "doctor-recommended" unless provided and true. `verify: true` (Turkish advertising board and supplement regulation).
- T3 block: health data and genetic data references must respect KVKK (no showing real customer data).
- T4 warn: comparative or superlative claims ("best", "most accurate") need proof.
- T5 warn: Turkish health-provider advertising restrictions may apply to the doctor/dietitian consultation element. `verify: true`.

### `b2b_healthtech` (Evreon)
- E1 block: never claim diagnostic capability or clinical accuracy numbers that are not published.
- E2 block: no customer logos, names or quotes unless provided by the operator.
- E3 warn: GDPR / EU data residency claims must match the site wording.

### Platform notes (feed into direction + compliance)
- Meta: personal health and appearance policy; health-related ad targeting limits; prescription drugs need authorization.
- TikTok: medical misinformation and weight-management ad restrictions (paid); organic posts still judged against community guidelines. `verify: true`.
- Reddit: self-promotion norms vary per subreddit; read each subreddit's rules (sidebar) and follow them; value-first posts; never astroturf.

## Sources
- Meta drugs and pharmaceuticals ad standard: https://transparency.meta.com/policies/ad-standards/restricted-goods-services/drugs-pharmaceuticals/
- LegitScript telehealth advertising disapprovals: https://www.legitscript.com/healthcare/certified-but-still-getting-disapproved-key-takeaways-from-our-telehealth-advertising-webinar/
- CMS guide, Slovakia: https://cms.law/en/int/expert-guides/cms-expert-guide-to-advertising-of-medicines-and-medical-devices/slovakia
- CMS guide, Czech Republic: https://cms.law/en/int/expert-guides/cms-expert-guide-to-advertising-of-medicines-and-medical-devices/czech-republic
