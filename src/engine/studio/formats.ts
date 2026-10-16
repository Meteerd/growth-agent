import type { TemplateId } from "./types";

/**
 * The format library: proven static and carousel formats for paid social, from the 2026 research
 * (docs/studio/WINNING_ADS.md: Motion's format taxonomy and hit rates, telehealth and app teardowns, ASA rulings).
 * Each format names the template that draws it and the slots it fills, with copy limits in characters (English;
 * Spanish runs ~30% longer, Slovak/Czech ~10%).
 */

export interface Format {
  id: string;
  name: string;
  stage: "cold" | "solution" | "warm";
  template: TemplateId;
  when: string;
  slots: string;
  image: string;
  /** what makes a new concept rather than a variant */
  vary: string;
  /** extra rules for health brands */
  health?: string;
  /** needs something real from the operator (testimonial, doctor, stat); skip if missing */
  needs?: "testimonial" | "person" | "stat" | "offer";
}

export const FORMATS: Format[] = [
  {
    id: "us_vs_them",
    name: "Us vs Them comparison",
    stage: "solution",
    template: "comparison",
    when: "3 to 5 provable differences against a category default (diet apps, a private trainer, going alone). Never name a competitor.",
    slots:
      "headline<=40, leftLabel (us)<=18, rightLabel (them)<=18, rows[3-5] {label<=28, us<=20, them<=20} (use Yes/No for ticks), cta<=18, footnote<=60",
    image: "none",
    vary: "who 'them' is; the row set (price vs access vs support); persona in the headline",
    health: "compare services only, never medicines; no claims you cannot substantiate",
  },
  {
    id: "testimonial",
    name: "Testimonial quote card",
    stage: "warm",
    template: "quote_card",
    when: "only with a real testimonial the operator provided (config.testimonials), quoted verbatim",
    slots: "quote<=90 (verbatim), attribution<=40",
    image: "calm lifestyle photo behind the quote (dimmed), or none",
    vary: "which objection the quote answers; speaker",
    health: "no weight numbers, no body photos; add 'Individual results vary.' in the footnote/primary text",
    needs: "testimonial",
  },
  {
    id: "reasons_why",
    name: "Reasons why (listicle)",
    stage: "solution",
    template: "checklist",
    when: "several differentiators, none dominant; mid-funnel education",
    slots: "eyebrow<=24 (optional), headline<=45 ('5 reasons ...'), bullets[3-5] each<=40, cta<=18",
    image: "optional product shot or lifestyle photo card",
    vary: "reason count, persona in the headline, which objection leads",
    health: "process, access and support reasons only, no outcomes",
  },
  {
    id: "old_way_new_way",
    name: "Old way vs new way",
    stage: "cold",
    template: "myth_fact",
    when: "the compliant alternative to before/after: contrast the old approach with the brand's",
    slots:
      "headline<=40, leftLabel='Old way' (localised), myth<=60 (the old way), rightLabel='New way', fact<=90 (the brand's way), cta<=18",
    image: "none",
    vary: "the old way named (calorie apps, crash diets, YouTube videos, group classes)",
    health: "never body before/after; the contrast is the system, not the person",
  },
  {
    id: "feature_stack",
    name: "Feature / benefit stack with product",
    stage: "solution",
    template: "split_panel",
    when: "the product has a visible surface (an app screen, a booking flow, a kit)",
    slots: "eyebrow<=24, headline<=40, body<=90, cta<=18",
    image: "product (the real phone screenshot) or a real brand image",
    vary: "which feature is the hero; hero type (phone vs person vs pet)",
    health: "no medication screens, dosing or drug names in UI",
  },
  {
    id: "notes_app",
    name: "Notes-app screenshot",
    stage: "cold",
    template: "notes_app",
    when: "confessional or list content ('things I wish I knew', 'questions to ask'); looks organic, very cheap to test",
    slots:
      "eyebrow=date line<=24 (e.g. 'Today at 21:14'), headline=note title<=40, bullets[4-7] each<=45, footnote=site<=30",
    image: "none",
    vary: "narrator (owner, trainer, doctor, patient), list type (mistakes, wins, questions)",
    health: "framed as from the brand, not a fake independent patient",
  },
  {
    id: "brand_post",
    name: "Social post card (the brand's own account)",
    stage: "cold",
    template: "post_card",
    when: "a hot take or plain-spoken truth in the brand voice",
    slots: "body<=200 (best under 120): the post text",
    image: "optional blurred lifestyle photo behind the card",
    vary: "the take; tone (blunt, funny, warm)",
    health: "never a fabricated third-party post",
  },
  {
    id: "ugc_photo",
    name: "UGC-style photo with native captions",
    stage: "cold",
    template: "ugc_caption",
    when: "the default cold-traffic static; persona hooks; native beats polished",
    slots: "headline<=60 (the hook, first person or persona call-out), body<=50 (the payoff)",
    image: "candid smartphone photo, natural light, real home or park, imperfect framing, no studio look",
    vary: "persona, setting, hook wording",
    health: "no bodies emphasised, no mirror selfies, scales, tapes; an AI person is never captioned as a patient",
  },
  {
    id: "photo_hook",
    name: "Bold photo + headline",
    stage: "cold",
    template: "photo_headline",
    when: "one strong promise or reframe over an emotional photo",
    slots: "eyebrow<=24 (topic), headline<=60, accentWord, body<=70, cta<=18",
    image: "photoreal scene that shows the moment (owner and dog, a calm video consult); calm top area for the type",
    vary: "the promise, the scene, the persona",
  },
  {
    id: "letter",
    name: "Letter from a real doctor or founder",
    stage: "cold",
    template: "letter",
    when: "authority without polish (Letter formats over-index on spend). Only with a real, named person the operator provided",
    slots:
      "eyebrow<=40 ('A note from ...'), headline<=50 (the belief being reframed), body<=140, bullets[1-3] each<=110 (more lines of the letter), attribution='Name, credential' (real)",
    image: "the person's real portrait (brand image) if available, else none",
    vary: "which belief is reframed; who signs",
    health: "real licensed doctor only, no prescribing promises, no drug talk; the safest high-trust format",
    needs: "person",
  },
  {
    id: "offer_card",
    name: "Offer-first banner",
    stage: "warm",
    template: "offer_card",
    when: "there is a real offer (trial, consult price, first week free); Offer-First Banner has the 2nd-highest hit rate",
    slots: "headline<=40, body<=60, price<=24 (the offer in big type), cta<=18, footnote<=70 (terms)",
    image: "product (phone screenshot) or a real brand image",
    vary: "offer type and framing (per day vs per year)",
    health: "price the consultation/service only, never medicine; no countdown urgency",
    needs: "offer",
  },
  {
    id: "myth_fact",
    name: "Myth vs fact",
    stage: "cold",
    template: "myth_fact",
    when: "education that reframes a common belief",
    slots: "headline<=50 (optional), leftLabel='Myth' (localised), myth<=60, rightLabel='Fact', fact<=90, cta<=18",
    image: "none",
    vary: "the myth topic",
    health: "facts general and evidence-based, no medication facts",
  },
  {
    id: "stat",
    name: "Stat-led",
    stage: "cold",
    template: "stat",
    when: "only a real number from the dossier proof or the operator (e.g. '10 min a day' as a product fact)",
    slots: "stat<=10, statLabel<=60, body<=80, footnote=source<=60",
    image: "dimmed photo behind",
    vary: "which number; framing",
    health: "no outcome stats (kg, %); access stats only if true",
    needs: "stat",
  },
  {
    id: "steps",
    name: "How it works (3 steps)",
    stage: "solution",
    template: "steps",
    when: "the process is the selling point (easy, fast, no waiting room); great for retargeting",
    slots: "headline<=40, bullets[3] each 'Title<=24: line<=50', cta<=18, footnote<=60",
    image: "none",
    vary: "which step is emphasised; persona",
    health: "add 'Treatment only if your doctor recommends it.' (localised) in the footnote",
  },
  {
    id: "quiz",
    name: "Quiz question",
    stage: "cold",
    template: "quiz",
    when: "the funnel starts with a quiz; makes people answer in their head",
    slots: "eyebrow<=24 ('1 minute quiz'), headline=question<=60, bullets=options[3-4] each<=28, cta<=18",
    image: "optional small photo",
    vary: "the question",
    health: "never ask the viewer to disclose a condition (no BMI); ask about preferences",
  },
  {
    id: "sticky_note",
    name: "Post-it note",
    stage: "cold",
    template: "sticky",
    when: "a tiny, human instruction or reminder (Post-it over-indexes on spend)",
    slots: "headline<=50 (the handwritten note), body<=40 (optional caption)",
    image: "a real surface: fridge door, laptop lid, dog crate, kitchen counter; the note area calm",
    vary: "the surface and the note",
  },
];

/** Carousel blueprints: slide roles in order. */
export const CAROUSELS = [
  {
    id: "benefit_stack",
    name: "Paid carousel: benefit stack (5 cards)",
    slides: [
      "hook + promise (works alone as an ad)",
      "benefit 1",
      "how it works / feature (product shot)",
      "proof (real only) or a reassurance",
      "CTA / offer",
    ],
  },
  {
    id: "myth_busting",
    name: "Myth-busting (6 cards)",
    slides: ["cover: 'N myths ...'", "myth 1 vs fact", "myth 2 vs fact", "myth 3 vs fact", "sendable checklist", "CTA"],
  },
  {
    id: "process",
    name: "What happens when you sign up (5 cards)",
    slides: ["cover: 'What your first month looks like'", "step 1", "step 2", "step 3", "CTA"],
  },
  {
    id: "problem_fix",
    name: "Fix [problem] in steps (7 cards)",
    slides: [
      "hook: the problem + promise",
      "why it happens (reassurance)",
      "step 1",
      "step 2",
      "step 3",
      "common mistake",
      "CTA",
    ],
  },
  {
    id: "decode",
    name: "Decode / understand (7 cards, organic first)",
    slides: [
      "cover: 'N things ... is telling you'",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "sendable cheat sheet",
      "CTA",
    ],
  },
];

export const formatById = (id: string) => FORMATS.find((f) => f.id === id);

export function formatLibraryText(): string {
  return [
    "FORMATS (id: name [stage] template | when | slots | image | vary | health):",
    ...FORMATS.map(
      (f) =>
        `- ${f.id}: ${f.name} [${f.stage}] template=${f.template}${f.needs ? ` NEEDS ${f.needs}` : ""} | ${f.when} | slots: ${f.slots} | image: ${f.image} | vary: ${f.vary}${f.health ? ` | health: ${f.health}` : ""}`,
    ),
    "",
    "CAROUSEL BLUEPRINTS (slide roles):",
    ...CAROUSELS.map((c) => `- ${c.id}: ${c.name}: ${c.slides.join(" > ")}`),
    "Carousel slide templates: text_slide (eyebrow=big number like '01', headline, body or bullets, optional image), any static template above for the cover, cta_end for the last card.",
  ].join("\n");
}

/** The 12 rules every ad follows (from the research). */
export const RULES = `RULES FOR WINNING STATICS AND CAROUSELS
1. A static has a hook: one dominant headline + one focal visual decides the scroll. One idea per ad. Cover headline 10 words or fewer.
2. Write for strangers (cold traffic): never assume brand awareness.
3. Concept diversity beats variants (Meta Andromeda groups near-duplicates): every ad in a batch differs on angle, persona, format or visual world. At least 3 hook types per batch.
4. Native beats polished on cold traffic: heavy branding at first glance reads as an ad and gets skipped. Logo small.
5. Carousel card 1 must work alone as a static. Each card one complete thought; visual continuity across cards; one sendable card (checklist/table) near the end.
6. Numbers beat adjectives, but only real numbers. Never invent stats, reviews, testimonials, user counts, prices or press.
7. Primary text: the key message in the first 125 characters. Headline 27 to 40 characters. Description <= 25.
8. Write natively in the target language (not translated). Correct diacritics. Spanish: tú; Slovak/Czech medical: formal Vy. Prices in local format (49 €, 1 290 Kč).
9. No AI-slop: no 'unlock', 'elevate', 'unleash', 'game changer', 'revolutionary', 'journey' clichés, no fake round numbers, no emoji in on-image text, no em dashes.
10. Every hook must be grounded: in a competitor pattern that wins, the brand dossier, or real customer words.`;
