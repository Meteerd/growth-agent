import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import type { Brand } from "@/contracts";
import { type BetaContentBlockParam, structured } from "../agent/claude";
import { checkText } from "../compliance/check";
import type { Db } from "../db/client";
import { newId } from "../ids";
import { rulePackText } from "../rules";
import { fileToUrl, urlToFile } from "../video/files";
import { getConfig, getSettings } from "./config";
import { FORMATS, formatById, formatLibraryText, RULES } from "./formats";
import { genImage, IMAGE_MODEL_INFO } from "./images";
import type { JobCtx } from "./jobs";
import { contactSheet, FULL_BLEED, renderSlide } from "./render/templates";
import { studioDir } from "./setup";
import { getAd, insertAd, kvGet, listRefs, updateAd } from "./store";
import {
  type Ad,
  type AdBody,
  type AdReview,
  type Aspect,
  type ImageModel,
  type Playbook,
  type Slide,
  type StudioBrandConfig,
  TEMPLATES,
} from "./types";

// ---------------------------------------------------------------- schemas

const SlotsOut = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  accentWord: z.string(),
  body: z.string(),
  bullets: z.array(z.string()),
  rows: z.array(z.object({ label: z.string(), us: z.string(), them: z.string() })),
  leftLabel: z.string(),
  rightLabel: z.string(),
  quote: z.string(),
  attribution: z.string(),
  stat: z.string(),
  statLabel: z.string(),
  myth: z.string(),
  fact: z.string(),
  price: z.string(),
  cta: z.string(),
  footnote: z.string(),
});
const SlideOut = z.object({
  template: z.enum(TEMPLATES),
  slots: SlotsOut,
  image: z.object({
    source: z.enum(["generated", "brand", "product", "none"]),
    /** index into the brand image list, or -1 */
    brandImage: z.number(),
    /** English image prompt for generated images (scene only, no text), "" otherwise */
    prompt: z.string(),
    /** generated images may use a brand image as a reference (product, pet, person look), -1 for none */
    referenceImage: z.number(),
  }),
});
const PlanOut = z.object({
  concepts: z.array(
    z.object({
      title: z.string(),
      format: z.string(),
      kind: z.enum(["static", "carousel"]),
      angle: z.string(),
      persona: z.string(),
      hookType: z.string(),
      inspiredBy: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
});
const AdOut = z.object({
  visualWorld: z.string(),
  copy: z.object({ primaryText: z.string(), headline: z.string(), description: z.string(), cta: z.string() }),
  slides: z.array(SlideOut),
});
type AdOut = z.infer<typeof AdOut>;
const ReviewOut = z.object({
  overall: z.number(),
  stopPower: z.number(),
  clarity: z.number(),
  brandFit: z.number(),
  craft: z.number(),
  textCorrect: z.boolean(),
  issues: z.array(z.string()),
  fix: z.string(),
  slideScores: z.array(z.number()),
  worstSlide: z.number(),
  imageIsTheProblem: z.boolean(),
  betterImagePrompt: z.string(),
});

// ---------------------------------------------------------------- context

const LANG: Record<string, string> = {
  en: "English",
  sk: "Slovak",
  cs: "Czech",
  es: "Spanish (Spain)",
  tr: "Turkish",
  de: "German",
  hu: "Hungarian",
  fr: "French",
  it: "Italian",
  pl: "Polish",
};
const langName = (l: string) => LANG[l.slice(0, 2)] ?? l;

const STILL =
  "Photoreal, shot on a recent iPhone, natural light, real lived-in place, candid framing, true-to-life colours, subtle grain. Absolutely no text, letters, numbers, logos, watermarks, signs or UI in the image. Not glossy, not CGI, not a stock photo, no plastic skin, natural hands.";
const HEALTH_NEG =
  "No syringes, injection pens, pills, blister packs, medicine boxes, scales, measuring tapes, bare bellies, body comparisons, hospital beds or procedures.";

interface Grounding {
  brand: Brand;
  cfg: StudioBrandConfig;
  playbook: Playbook | null;
  refs: {
    id: string;
    advertiser: string;
    type: string;
    days?: number;
    variants?: number;
    format: string;
    hook: string;
    layout: string;
    angle: string;
    steal: string;
    slides: string[];
  }[];
  brandImages: { i: number; url: string; note?: string; file: string }[];
  health: boolean;
}

async function grounding(db: Db, brand: Brand): Promise<Grounding> {
  const cfg = await getConfig(db, brand);
  const playbook = await kvGet<Playbook>(db, `playbook:${brand.id}`);
  const refs = (await listRefs(db, brand.id))
    .filter((r) => r.body.analysis && !r.body.analysis.irrelevant)
    .slice(0, 24)
    .map((r) => ({
      id: r.id,
      advertiser: r.advertiser,
      type: r.mediaType,
      days: r.body.daysRunning,
      variants: r.body.variants,
      format: r.body.analysis!.format,
      hook: r.body.analysis!.hook,
      layout: r.body.analysis!.layout,
      angle: r.body.analysis!.angle,
      steal: r.body.analysis!.steal,
      slides: r.body.analysis!.slides,
    }));
  const brandImages = cfg.brandImages
    .map((b, i) => ({ i, url: b.url, note: b.note, file: urlToFile(b.url) ?? "" }))
    .filter((b) => b.file && fs.existsSync(b.file));
  return {
    brand,
    cfg,
    playbook,
    refs,
    brandImages,
    health: brand.rulePack !== "common" || brand.vertical === "telehealth_rx",
  };
}

function brandBrief(g: Grounding) {
  const d = g.brand.dossier;
  return {
    brand: g.brand.name,
    site: g.cfg.ctaUrl,
    oneLiner: d.oneLiner,
    positioning: d.positioning,
    offers: d.offers,
    personas: d.personas,
    voice: d.voice,
    proof: d.proof,
    claimsAllowed: d.claimsAllowed,
    claimsForbidden: d.claimsForbidden,
    offerToPush: g.cfg.offer ?? null,
    testimonials: g.cfg.testimonials,
    requiredDisclaimers: g.cfg.disclaimers,
    operatorNotes: [...g.cfg.notes, ...(d.operatorNotes ?? []).map((n) => `${n.prompt}: ${n.answer}`)],
  };
}

async function brandImageBlocks(g: Grounding): Promise<BetaContentBlockParam[]> {
  const out: BetaContentBlockParam[] = [];
  for (const b of g.brandImages.slice(0, 14)) {
    try {
      const t = await sharp(b.file)
        .flatten({ background: "#fff" })
        .resize(256, 256, { fit: "inside" })
        .jpeg({ quality: 70 })
        .toBuffer();
      out.push({ type: "text", text: `Brand image ${b.i}${b.note ? ` (${b.note})` : ""}` });
      out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: t.toString("base64") } });
    } catch {
      // skip unreadable
    }
  }
  return out;
}

// ---------------------------------------------------------------- plan

export interface BatchInput {
  count?: number;
  carousels?: number;
  formats?: string[];
  angles?: string[];
  language?: string;
  aspect?: Aspect;
  model?: ImageModel;
  notes?: string;
  refIds?: string[];
  placement?: "paid" | "organic";
}

async function plan(ctx: JobCtx, g: Grounding, input: BatchInput, count: number, carousels: number) {
  const allowedFormats = FORMATS.filter((f) => {
    if (f.needs === "testimonial" && !g.cfg.testimonials.length) return false;
    if (f.needs === "offer" && !g.cfg.offer && !g.brand.dossier.offers.some((o) => o.price)) return false;
    return true;
  });
  const res = await structured(
    { db: ctx.db },
    {
      route: "strategy",
      system: `You are the creative director planning a batch of Meta (Facebook/Instagram) ads for ${g.brand.name}. You remake the STRUCTURES that already win in this market (from the competitor teardown and playbook) for this brand. Plan ${count} distinct concepts: ${carousels} carousel(s) and ${count - carousels} static(s).

${RULES}

Diversity: no two concepts share the same angle + persona + format; use at least 3 hook types and at least 4 different formats when count >= 5. Lead with what the playbook shows is winning, plus at least one white-space idea nobody in the category does.
Only use formats from this list (others need things the brand has not provided): ${allowedFormats.map((f) => f.id).join(", ")}. A carousel's format is its cover format.
title: a short working title. angle: a short phrase (under 8 words). persona: under 8 words. hookType: one or two words. inspiredBy: ids of the competitor ads whose structure a concept remakes ([] for white space). rationale: one or two sentences on why this should win, citing the evidence. Most concepts should be visual (a strong photo or the real product as the focal point); at most a third of a batch may be type-only formats.
${g.health ? "This is a health brand with strict rules: no outcomes, no body focus, no drug talk, no 'you' + condition. Angles: doctor-led care, convenience, transparency, support, education." : ""}
${formatLibraryText()}

Brand compliance rule pack:
${rulePackText(g.brand.rulePack)}`,
      user: JSON.stringify({
        brief: brandBrief(g),
        operatorRequest: { formats: input.formats, angles: input.angles, notes: input.notes, focusRefs: input.refIds },
        playbook: g.playbook,
        competitorWinners: g.refs,
      }),
      schema: PlanOut,
      note: `studio plan ${g.brand.slug}: ${count} ads`,
      maxTokens: 12000,
      demo: () => ({
        concepts: Array.from({ length: count }, (_, i) => {
          const f = allowedFormats[i % allowedFormats.length]!;
          return {
            title: `${f.name} (demo)`,
            format: f.id,
            kind: i < carousels ? ("carousel" as const) : ("static" as const),
            angle: "demo",
            persona: "demo",
            hookType: "demo",
            inspiredBy: [],
            rationale: "Demo mode.",
          };
        }),
      }),
    },
  );
  await ctx.cost(res.usd);
  return res.value.concepts.slice(0, count);
}

// ---------------------------------------------------------------- write one ad

async function writeAd(
  ctx: JobCtx,
  g: Grounding,
  concept: z.infer<typeof PlanOut>["concepts"][number],
  o: { language: string; aspect: Aspect; feedback?: string; previous?: AdOut },
): Promise<AdOut> {
  const fmt = formatById(concept.format);
  const inspired = g.refs.filter((r) => concept.inspiredBy.includes(r.id));
  const carousel = concept.kind === "carousel";
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: JSON.stringify({
        concept,
        format: fmt ?? concept.format,
        language: langName(o.language),
        aspect: o.aspect,
        brief: brandBrief(g),
        inspiredBy: inspired,
        brandImages: g.brandImages.map((b) => ({ index: b.i, note: b.note ?? "" })),
        productShotAvailable: !!g.cfg.productShot,
        ...(o.previous ? { previousVersion: o.previous } : {}),
        ...(o.feedback ? { feedback: o.feedback } : {}),
      }),
    },
    ...(await brandImageBlocks(g)),
  ];
  const res = await structured(
    { db: ctx.db },
    {
      route: "production",
      system: `You write and art-direct one Meta ad for ${g.brand.name}: ${carousel ? "a carousel of 4 to 7 slides (cover first, CTA last)" : "a single static"}. Language of every word on the image and in the copy: ${langName(o.language)}, written natively by a local copywriter (not translated), correct diacritics, sentence case.

${RULES}

How slides work: each slide picks a template and fills its slots. Slots a template does not use stay "" or []. Template guide:
- photo_headline: eyebrow, headline (+accentWord), body, cta over a full-bleed photo (type sits top).
- split_panel: photo or product on top, eyebrow, headline, body, cta below.
- checklist: eyebrow, headline, bullets[3-5], cta; optional photo card.
- comparison: headline, leftLabel (us), rightLabel (them), rows[3-5] {label, us, them} (Yes/No become ticks), cta, footnote.
- quote_card: quote (verbatim from testimonials only), attribution.
- notes_app: eyebrow (date line), headline (note title), body, bullets, footnote.
- post_card: body (the post text, the brand's own account).
- stat: stat, statLabel, body, footnote (real numbers only).
- myth_fact: headline, leftLabel ('Myth' localised or 'Old way'), myth, rightLabel ('Fact' or 'New way'), fact, cta.
- offer_card: headline, body, price (the offer), cta, footnote (terms).
- text_slide (carousel body): eyebrow (a big number like '01' or a short label), headline, body or bullets[2-4]; optional image.
- cta_end (carousel last): headline, body, cta (button text; the site URL is added automatically).
- ugc_caption: headline (hook, native caption), body (payoff) over a candid photo.
- letter: eyebrow ('A note from ...'), headline, body, bullets (more lines), attribution ('Real Name, credential').
- quiz: eyebrow, headline (question), bullets (3-4 options), cta.
- sticky: headline (the handwritten note, short), body (caption).
- steps: headline, bullets[3] as 'Title: one line', cta, footnote.
Images sell: a static's focal visual and a carousel's cover need a strong picture (generated scene, real brand image or the product) unless the format is text-native (notes_app, post_card, comparison, quiz, steps). In a carousel, at least half the slides carry an image (text_slide and checklist can take one). Use the format's template for a static (${fmt?.template ?? "its template"}). Carousels: cover = the format's template (must work alone as an ad), then text_slide / checklist / myth_fact / comparison / steps body slides, last = cta_end. accentWord: one word copied from that slide's headline.

Images: source "brand" uses a real brand image (brandImage = its index; only if it fits as described); "product" uses the real phone screenshot of the site (feature, offer and how-it-works slides); "generated" needs prompt: an English scene description only (who, where, doing what, light, mood, camera), never text in the image; visualWorld is one sentence describing the shared look (people, place, palette, light) that every generated image in this ad shares so slides stay consistent. referenceImage: a brand image index to keep the real product, pet or person look in a generated image, else -1. "none" for type-only templates (comparison, notes_app, myth_fact, quiz, steps, text_slide usually).
${g.health ? `Health brand: images never show ${HEALTH_NEG} Never present an AI person as a patient or doctor in a testimonial.` : ""}
Copy for Ads Manager: primaryText (key message in the first 125 characters, total under 300, plain, may include line breaks), headline (27 to 40 characters), description (under 25), cta = the Meta button (one of: Learn More, Sign Up, Book Now, Download, Install Now, Get Offer, Subscribe, Shop Now). Include any required disclaimer in primaryText.
The picture must show what the headline says (an ad about leaving the house shows that moment, not a settings screen). Use the product shot only when the slide is about the product itself. The on-image CTA matches the Meta button's intent (Sign Up/Download -> 'Start your plan' or 'Get the app'; Learn More -> 'See how it works'; Book Now -> 'Book a consultation').
Never invent numbers, prices, reviews, names or credentials not in the brief. No em dashes. No emoji on images.

Brand compliance rule pack:
${rulePackText(g.brand.rulePack)}`,
      user: content,
      schema: AdOut,
      note: `studio write ${g.brand.slug}: ${concept.title.slice(0, 40)}`,
      maxTokens: 16000,
      demo: () => demoAd(concept.title, carousel, fmt?.template ?? "photo_headline"),
    },
  );
  await ctx.cost(res.usd);
  return res.value;
}

function demoAd(title: string, carousel: boolean, template: Slide["template"]): AdOut {
  const empty = {
    eyebrow: "",
    headline: title,
    accentWord: "",
    body: "Demo copy (no live model).",
    bullets: ["One", "Two", "Three"],
    rows: [{ label: "Demo", us: "Yes", them: "No" }],
    leftLabel: "",
    rightLabel: "",
    quote: "",
    attribution: "",
    stat: "",
    statLabel: "",
    myth: "Myth",
    fact: "Fact",
    price: "",
    cta: "Learn more",
    footnote: "",
  };
  const s = (t: Slide["template"]) => ({
    template: t,
    slots: empty,
    image: { source: "none" as const, brandImage: -1, prompt: "", referenceImage: -1 },
  });
  return {
    visualWorld: "",
    copy: { primaryText: "Demo ad.", headline: title.slice(0, 40), description: "", cta: "Learn More" },
    slides: carousel ? [s(template), s("text_slide"), s("text_slide"), s("cta_end")] : [s(template)],
  };
}

function adText(a: AdOut): string {
  return [
    `Primary text: ${a.copy.primaryText}`,
    `Headline: ${a.copy.headline}`,
    `Description: ${a.copy.description}`,
    ...a.slides.map((s, i) => {
      const sl = s.slots;
      const parts = [
        sl.eyebrow,
        sl.headline,
        sl.body,
        ...sl.bullets,
        ...sl.rows.map((r) => `${r.label}: ${r.us} vs ${r.them}`),
        sl.quote,
        sl.attribution,
        sl.stat,
        sl.statLabel,
        sl.myth,
        sl.fact,
        sl.price,
        sl.cta,
        sl.footnote,
      ].filter(Boolean);
      return `Slide ${i + 1} (${s.template}): ${parts.join(" | ")}${s.image.prompt ? ` | image prompt: ${s.image.prompt}` : ""}`;
    }),
  ].join("\n");
}

// ---------------------------------------------------------------- produce (images + render + review)

const semaphore = (n: number) => {
  let active = 0;
  const q: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((r) => q.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      q.shift()?.();
    }
  };
};
const imageSlots = semaphore(3);

function zoneFor(t: Slide["template"], aspect: Aspect): string {
  if (t === "photo_headline")
    return aspect === "9:16"
      ? "Keep the upper half calm and simple (wall, sky, soft background) for a headline; subject in the lower half."
      : "Keep the top 45% of the frame calm and uncluttered for a headline; the subject sits in the lower half.";
  if (t === "ugc_caption") return "Subject in the lower two thirds; the area around the upper third simple.";
  if (t === "sticky")
    return "A plain flat surface (fridge door, laptop lid, crate side, kitchen cabinet) fills the centre of the frame where a sticky note will be placed.";
  if (FULL_BLEED.includes(t)) return "Leave calm space around the centre for text.";
  if (t === "split_panel") return "Wide-ish composition, subject centred.";
  return "";
}

async function slideImage(
  ctx: JobCtx,
  g: Grounding,
  s: z.infer<typeof SlideOut>,
  o: { aspect: Aspect; model: ImageModel; visualWorld: string; dir: string; idx: number; promptOverride?: string },
): Promise<{ file?: string; image: Slide["image"] }> {
  const src = s.image.source;
  if (src === "none") return { image: { source: "none" } };
  if (src === "product" && g.cfg.productShot) {
    const f = urlToFile(g.cfg.productShot);
    if (f && fs.existsSync(f)) return { file: f, image: { source: "product", url: g.cfg.productShot } };
  }
  const bi = g.brandImages.find((b) => b.i === s.image.brandImage);
  if (src === "brand" && bi && !o.promptOverride) return { file: bi.file, image: { source: "brand", url: bi.url } };
  const prompt = [
    o.promptOverride ?? s.image.prompt ?? s.slots.headline,
    o.visualWorld ? `Shared look: ${o.visualWorld}.` : "",
    s.template === "native" ? "" : STILL,
    zoneFor(s.template, o.aspect),
    g.health ? HEALTH_NEG : "",
  ]
    .filter(Boolean)
    .join(" ");
  const ref = g.brandImages.find((b) => b.i === s.image.referenceImage);
  const out = path.join(o.dir, `img_${o.idx}_${Date.now().toString(36)}.png`);
  const r = await imageSlots(() =>
    genImage(ctx.db, {
      model: o.model,
      prompt,
      aspect: o.aspect,
      refs: ref ? [ref.file] : [],
      out,
      signal: ctx.signal,
      note: `studio image ${g.brand.slug}`,
    }),
  );
  await ctx.cost(r.usd);
  return {
    file: r.file,
    image: {
      source: "generated",
      prompt: o.promptOverride ?? s.image.prompt,
      model: r.model,
      url: fileToUrl(r.file),
      usd: r.usd,
    },
  };
}

async function review(
  ctx: JobCtx,
  g: Grounding,
  ad: { title: string; format: string; copy: AdOut["copy"]; slides: Slide[]; files: string[] },
) {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: `Brand: ${g.brand.name}. Format: ${ad.format}. Intended copy per slide: ${JSON.stringify(ad.slides.map((s) => s.slots))}\nAds Manager copy: ${JSON.stringify(ad.copy)}`,
    },
  ];
  for (const [i, f] of ad.files.entries()) {
    const b = await sharp(f).resize(540, 960, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
    content.push({ type: "text", text: `Slide ${i + 1}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } });
  }
  const r = await structured(
    { db: ctx.db },
    {
      route: "vision",
      system: `You are a strict paid-social creative director judging an ad before it ships on Meta. Score 0 to 100, calibrated: 85+ only if it would hold up next to the best ads in the category. stopPower: would a stranger stop on slide 1 in the feed? clarity: one idea, readable at phone size in a second. brandFit: looks and sounds like this brand, logo present but not shouting. craft: layout, type, image quality; AI tells (warped hands, plastic skin, nonsense text, uncanny faces, stock gloss) cost a lot. textCorrect: every visible word matches the intended copy exactly (no garbled or extra text in images). issues: concrete problems. fix: the single most valuable change. slideScores: one per slide. worstSlide: 0-based index of the weakest slide. imageIsTheProblem: true if a better background image would fix the worst slide; betterImagePrompt: a better English scene prompt for it (no text in image), else "". ${g.health ? "Health brand: flag any body focus, medical procedure imagery or implied outcome as a serious issue." : ""} No em dashes.`,
      user: content,
      schema: ReviewOut,
      note: `studio review ${g.brand.slug}`,
      maxTokens: 6000,
      demo: () => ({
        overall: 0,
        stopPower: 0,
        clarity: 0,
        brandFit: 0,
        craft: 0,
        textCorrect: true,
        issues: ["Demo mode: not reviewed"],
        fix: "",
        slideScores: ad.files.map(() => 0),
        worstSlide: 0,
        imageIsTheProblem: false,
        betterImagePrompt: "",
      }),
    },
  );
  await ctx.cost(r.usd);
  return r.value;
}

async function renderAll(
  g: Grounding,
  slides: Slide[],
  files: (string | undefined)[],
  aspect: Aspect,
  dir: string,
  version: number,
) {
  const out: string[] = [];
  let minContrast = 21;
  for (const [i, s] of slides.entries()) {
    const r = await renderSlide({
      slide: s,
      aspect,
      brand: { name: g.brand.name, config: g.cfg },
      imageFile: files[i],
      index: slides.length > 1 ? { i, n: slides.length } : undefined,
      out: path.join(dir, `v${version}`, `slide_${i + 1}.png`),
    });
    minContrast = Math.min(minContrast, r.minContrast);
    s.png = fileToUrl(r.file);
    out.push(r.file);
  }
  return { files: out, minContrast };
}

type Concept = z.infer<typeof PlanOut>["concepts"][number];
type ReviewV = z.infer<typeof ReviewOut>;

/** Images + render + review of one written version. */
async function renderVersion(
  ctx: JobCtx,
  g: Grounding,
  ad: Ad,
  written: AdOut,
  model: ImageModel,
  version: number,
  previous?: { slides: Slide[]; files: (string | undefined)[] },
) {
  const dir = studioDir("ads", g.brand.slug, ad.id);
  const imgs = await Promise.all(
    written.slides.map(async (s, i) => {
      // a new version keeps an image when its source and prompt did not change
      const prev = previous?.slides[i];
      if (
        prev &&
        previous?.files[i] &&
        prev.image.source === "generated" &&
        s.image.source === "generated" &&
        prev.image.prompt === s.image.prompt
      )
        return { file: previous.files[i], image: prev.image };
      return slideImage(ctx, g, s, { aspect: ad.body.aspect, model, visualWorld: written.visualWorld, dir, idx: i });
    }),
  );
  const slides: Slide[] = written.slides.map((s, i) => ({
    template: s.template,
    slots: s.slots,
    image: imgs[i]!.image,
  }));
  const files = imgs.map((x) => x.file);
  const rendered = await renderAll(g, slides, files, ad.body.aspect, dir, version);
  const rv = await review(ctx, g, {
    title: ad.body.title,
    format: ad.format,
    copy: written.copy,
    slides,
    files: rendered.files,
  });
  if (rendered.files.length > 1) await contactSheet(rendered.files, path.join(dir, `v${version}`, "sheet.jpg"));
  return { written, slides, files, rendered, rv };
}

const toReview = (rv: ReviewV, minContrast: number): AdReview => ({
  overall: rv.overall,
  stopPower: rv.stopPower,
  clarity: rv.clarity,
  brandFit: rv.brandFit,
  craft: rv.craft,
  textCorrect: rv.textCorrect,
  issues: [...rv.issues, ...(minContrast < 3 ? [`Low text contrast somewhere (${minContrast}:1)`] : [])],
  fix: rv.fix,
  slideScores: rv.slideScores,
});

/**
 * Render and review; if the creative director scores it under the threshold, its critique goes back to the
 * copywriter/art director as feedback for one self-revision (copy, template, image), which is gated and rendered
 * again. The better of the two becomes the ad; both stay in its version history.
 */
async function produce(
  ctx: JobCtx,
  g: Grounding,
  ad: Ad,
  concept: Concept,
  written: AdOut,
  model: ImageModel,
  previous?: { slides: Slide[]; files: (string | undefined)[] },
) {
  await updateAd(ctx.db, ad.id, { status: "rendering" });
  const base = ad.body.versions.length;
  const settings = await getSettings(ctx.db);
  const first = await renderVersion(ctx, g, ad, written, model, base + 1, previous);
  const done: { at: string; slides: Slide[]; review?: AdReview }[] = [
    { at: new Date().toISOString(), slides: first.slides, review: toReview(first.rv, first.rendered.minContrast) },
  ];
  let best = first;
  if (first.rv.overall > 0 && first.rv.overall < settings.reviewThreshold) {
    await ctx.log(`"${ad.body.title}" scored ${first.rv.overall}; self-revising: ${first.rv.fix}`);
    try {
      const rewritten = await writeAd(ctx, g, concept, {
        language: ad.body.language,
        aspect: ad.body.aspect,
        previous: written,
        feedback: `The creative director scored the rendered ad ${first.rv.overall}/100 (stop power ${first.rv.stopPower}, clarity ${first.rv.clarity}, craft ${first.rv.craft}). Issues: ${first.rv.issues.join(" | ")}. Most valuable change: ${first.rv.fix}. Fix all of it: you may change the template, the copy, the image source or the image prompt (for a better or more fitting picture). Keep one clear idea; the image must show what the headline says.`,
      });
      const gc = await gate(ctx, g, rewritten, ad.body.placement, ad.id);
      if (gc.status !== "fail") {
        const second = await renderVersion(ctx, g, ad, rewritten, model, base + 2, {
          slides: first.slides,
          files: first.files,
        });
        done.push({
          at: new Date().toISOString(),
          slides: second.slides,
          review: toReview(second.rv, second.rendered.minContrast),
        });
        if (second.rv.overall > first.rv.overall) best = second;
        await ctx.log(
          `"${ad.body.title}" self-revision scored ${second.rv.overall} (kept v${best === second ? 2 : 1})`,
        );
      }
    } catch (e) {
      await ctx.log(`Self-revision failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  const reviewOut = toReview(best.rv, best.rendered.minContrast);
  const cur = (await getAd(ctx.db, ad.id))!;
  // the chosen version goes last, so "the latest version" is always what the board shows
  const ordered = best === first && done.length > 1 ? [done[1]!, done[0]!] : done;
  const body: AdBody = {
    ...cur.body,
    copy: best.written.copy,
    slides: best.slides,
    review: reviewOut,
    versions: [...cur.body.versions, ...ordered],
  };
  await updateAd(ctx.db, ad.id, { status: "ready", score: best.rv.overall, body });
  return { ...cur, status: "ready" as const, score: best.rv.overall, body };
}

// ---------------------------------------------------------------- compliance gate

async function gate(ctx: JobCtx, g: Grounding, written: AdOut, placement: "paid" | "organic", targetId: string) {
  const c = await checkText(ctx.db, {
    brand: g.brand,
    text: adText(written),
    paid: placement === "paid",
    targetType: "concept",
    targetId,
  });
  // the LegitScript / paid-placement rule is about the account, not the creative: keep it as a warning on the ad
  const blocking = c.findings.filter((f) => f.severity === "block" && f.ruleId !== "RX4");
  return {
    status: blocking.length ? ("fail" as const) : c.status === "fail" ? ("warn" as const) : c.status,
    findings: c.findings,
    blocking,
  };
}

// ---------------------------------------------------------------- batch

export async function generateBatch(ctx: JobCtx, brand: Brand, input: BatchInput) {
  const { db } = ctx;
  const g = await grounding(db, brand);
  const settings = await getSettings(db);
  const count = Math.max(1, Math.min(input.count ?? 6, settings.maxAdsPerBatch));
  const carousels = Math.max(0, Math.min(input.carousels ?? Math.round(count / 3), count));
  const language = input.language ?? g.cfg.defaultLanguage;
  const aspect = input.aspect ?? g.cfg.aspects[0] ?? "4:5";
  const model = input.model ?? g.cfg.imageModel;
  const placement = input.placement ?? g.cfg.placement;
  const batchId = newId("batch");
  await ctx.step(`Planning ${count} ads (${carousels} carousels) in ${langName(language)}`, 0.03);
  const concepts = await plan(ctx, g, input, count, carousels);
  await ctx.log(`Concepts: ${concepts.map((c) => `${c.title} [${c.format}]`).join("; ")}`);

  // one row per concept so the board shows them immediately
  const rows: Ad[] = [];
  for (const c of concepts)
    rows.push(
      await insertAd(db, {
        id: newId("ad"),
        brandId: brand.id,
        batchId,
        format: c.format,
        kind: c.kind,
        status: "queued",
        score: null,
        body: {
          title: c.title,
          angle: c.angle,
          persona: c.persona,
          rationale: c.rationale,
          inspiredBy: c.inspiredBy,
          language,
          aspect,
          placement,
          copy: { primaryText: "", headline: "", description: "", cta: "" },
          slides: [],
          feedback: [],
          versions: [],
          costUsd: 0,
        },
      }),
    );

  let done = 0;
  const results: { id: string; title: string; status: string; score: number | null }[] = [];
  const work = rows.map((row, i) => async () => {
    const c = concepts[i]!;
    try {
      ctx.check();
      let written = await writeAd(ctx, g, c, { language, aspect });
      let gc = await gate(ctx, g, written, placement, row.id);
      if (gc.status === "fail") {
        await ctx.log(`"${c.title}" failed compliance, rewriting: ${gc.blocking.map((f) => f.message).join("; ")}`);
        written = await writeAd(ctx, g, c, {
          language,
          aspect,
          previous: written,
          feedback: `Compliance failed. Fix every finding: ${gc.blocking.map((f) => `[${f.ruleId}] ${f.message}${f.excerpt ? ` ("${f.excerpt}")` : ""}`).join("; ")}`,
        });
        gc = await gate(ctx, g, written, placement, row.id);
      }
      const compliance = {
        status: gc.status,
        findings: gc.findings.map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message })),
      };
      if (gc.status === "fail") {
        await updateAd(db, row.id, {
          status: "failed",
          body: { ...row.body, copy: written.copy, compliance, error: "Failed compliance twice; not rendered." },
        });
        results.push({ id: row.id, title: c.title, status: "failed", score: null });
        return;
      }
      await updateAd(db, row.id, { body: { ...row.body, copy: written.copy, compliance } });
      const fresh = (await getAd(db, row.id))!;
      const doneAd = await produce(ctx, g, fresh, c, written, model);
      results.push({ id: row.id, title: c.title, status: "ready", score: doneAd.score });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateAd(db, row.id, { status: "failed", body: { ...row.body, error: msg } });
      results.push({ id: row.id, title: c.title, status: "failed", score: null });
      await ctx.log(`"${c.title}" failed: ${msg}`);
    } finally {
      done++;
      await ctx.step(`${done} of ${rows.length} ads done`, 0.1 + (0.9 * done) / rows.length);
    }
  });
  // two ads at a time (each fans out its own images through the shared image semaphore)
  const queue = [...work];
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      for (let w = queue.shift(); w; w = queue.shift()) await w();
    }),
  );
  return { batchId, ads: results, model: IMAGE_MODEL_INFO[model].label };
}

// ---------------------------------------------------------------- revise

export async function reviseAd(
  ctx: JobCtx,
  brand: Brand,
  adId: string,
  feedback: string,
  o: { model?: ImageModel } = {},
) {
  const { db } = ctx;
  const ad = await getAd(db, adId);
  if (!ad) throw new Error(`No ad ${adId}`);
  const g = await grounding(db, brand);
  const model = o.model ?? g.cfg.imageModel;
  const previous: AdOut = {
    visualWorld: "",
    copy: ad.body.copy,
    slides: ad.body.slides.map((s) => ({
      template: s.template,
      slots: {
        ...SlotsOut.parse({
          eyebrow: "",
          headline: "",
          accentWord: "",
          body: "",
          bullets: [],
          rows: [],
          leftLabel: "",
          rightLabel: "",
          quote: "",
          attribution: "",
          stat: "",
          statLabel: "",
          myth: "",
          fact: "",
          price: "",
          cta: "",
          footnote: "",
        }),
        ...s.slots,
      },
      image: {
        source: s.image.source,
        brandImage: g.brandImages.find((b) => b.url === s.image.url)?.i ?? -1,
        prompt: s.image.prompt ?? "",
        referenceImage: -1,
      },
    })),
  };
  await ctx.step(`Revising "${ad.body.title}"`, 0.1);
  await updateAd(db, adId, {
    body: { ...ad.body, feedback: [...ad.body.feedback, { at: new Date().toISOString(), text: feedback }] },
  });
  const concept = {
    title: ad.body.title,
    format: ad.format,
    kind: ad.kind,
    angle: ad.body.angle,
    persona: ad.body.persona,
    hookType: "",
    inspiredBy: ad.body.inspiredBy,
    rationale: ad.body.rationale,
  };
  let written = await writeAd(ctx, g, concept, {
    language: ad.body.language,
    aspect: ad.body.aspect,
    previous,
    feedback: `Operator feedback on the previous version: ${feedback}\nChange only what the feedback asks for (plus anything it implies). Keep everything else identical, including image prompts you are not asked to change.`,
  });
  let gc = await gate(ctx, g, written, ad.body.placement, adId);
  if (gc.status === "fail") {
    written = await writeAd(ctx, g, concept, {
      language: ad.body.language,
      aspect: ad.body.aspect,
      previous: written,
      feedback: `Compliance failed: ${gc.blocking.map((f) => `[${f.ruleId}] ${f.message}`).join("; ")}. Also keep the operator's feedback: ${feedback}`,
    });
    gc = await gate(ctx, g, written, ad.body.placement, adId);
    if (gc.status === "fail")
      throw new Error(`The revision fails compliance: ${gc.blocking.map((f) => f.message).join("; ")}`);
  }
  await ctx.step("Rendering the new version", 0.4);
  const fresh = (await getAd(db, adId))!;
  await updateAd(db, adId, {
    body: {
      ...fresh.body,
      compliance: {
        status: gc.status,
        findings: gc.findings.map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message })),
      },
    },
  });
  const prevFiles = ad.body.slides.map((s) => (s.image.url ? (urlToFile(s.image.url) ?? undefined) : undefined));
  const done = await produce(ctx, g, (await getAd(db, adId))!, concept, written, model, {
    slides: ad.body.slides,
    files: prevFiles,
  });
  return { id: adId, score: done.score, version: done.body.versions.length };
}
