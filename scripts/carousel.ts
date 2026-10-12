/**
 * pnpm carousel <slug>   (npx tsx --tsconfig tsconfig.json scripts/carousel.ts <slug>)
 * One 6-slide carousel for a brand: Claude writes the slides (market language, grounded in the dossier and the latest
 * run's evidence), compliance gates the copy and image prompts, OpenAI makes the photoreal backgrounds where no real
 * brand image fits, the site is screenshotted on a phone for the product slide, carousel.ts renders, Claude vision
 * reviews (one image fix if a slide scores under 70). Output: public/showcase/carousels/<slug>/.
 */
import { z } from "zod";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "openai";
const slug = process.argv[2];
if (!slug) {
  console.error("usage: carousel <slug>");
  process.exit(1);
}
const fs = await import("node:fs");
const path = await import("node:path");
const sharp = (await import("sharp")).default;
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { structured } = await import("@/engine/agent/claude");
const { checkText } = await import("@/engine/compliance/check");
const { generateImage } = await import("@/engine/providers/openai");
const { brandImages } = await import("@/engine/flagship");
const { brandAssetsDir } = await import("@/engine/video/files");
const { renderCarousel, CW, CH } = await import("@/engine/video/carousel");
type CarouselSlide = import("@/engine/video/carousel").CarouselSlide;
type BetaContentBlockParam = import("@/engine/agent/claude").BetaContentBlockParam;

const db = await getDb();
const brand = (await repo.listBrands(db)).find((b) => b.slug === slug);
if (!brand) throw new Error(`no brand ${slug}`);
const run = (await repo.listRuns(db, brand.id))[0];
const runId = run?.id;
const LANG: Record<string, string> = { hound: "en", aclinic: "sk", dynova: "tr" };
const LANG_NAME: Record<string, string> = { en: "English (UK)", sk: "Slovak", tr: "Turkish" };
const language = LANG[slug] ?? brand.languages[0] ?? "en";
const site = new URL(brand.url).host.replace(/^www\./, "");
const outDir = path.resolve("public/showcase/carousels", slug);
const work = path.join(outDir, "_work");
fs.mkdirSync(work, { recursive: true });
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ---------------------------------------------------------------- grounding

const evidence = runId ? await repo.listEvidence(db, runId) : [];
const evItems = evidence
  .filter((e) => e.text || e.deconstruction)
  .sort((a, b) => Number(!!b.deconstruction) - Number(!!a.deconstruction))
  .slice(0, 40)
  .map((e) => ({
    id: e.id,
    source: e.source,
    kind: e.kind,
    title: e.title.slice(0, 140),
    text: e.text?.slice(0, 500),
    hook: e.deconstruction?.hook,
    format: e.deconstruction?.format,
    angle: e.deconstruction?.angle,
    demo: e.demo,
  }));
const d = brand.dossier;
const grounding = {
  brand: brand.name,
  site,
  oneLiner: d.oneLiner,
  positioning: d.positioning,
  offers: d.offers,
  personas: d.personas,
  voice: d.voice,
  proof: d.proof,
  claimsAllowed: d.claimsAllowed,
  claimsForbidden: d.claimsForbidden,
  operatorNotes: d.operatorNotes?.map((n) => ({ q: n.prompt, a: n.answer })),
};
const files = brandImages(slug);

// ---------------------------------------------------------------- site screenshot (the real product on a phone)

const shot = path.join(work, "site.png");
if (!fs.existsSync(shot)) {
  log("screenshot", brand.url);
  const { recordSite } = await import("@/engine/video/screen");
  const { extractFrame } = await import("@/engine/media/ffmpeg");
  const mp4 = path.join(work, "site.mp4");
  await recordSite(brand.url, mp4, { seconds: 0.3, scrollPx: 0, language, waitMs: 2500 });
  await extractFrame(mp4, 0.1, shot.replace(/\.png$/, ".jpg"), 1080);
  await sharp(shot.replace(/\.png$/, ".jpg"))
    .png()
    .toFile(shot);
}

// ---------------------------------------------------------------- copy

const Slide = z.object({
  role: z.enum(["hook", "point", "product", "cta"]),
  headline: z.string(),
  accentWord: z.string(),
  body: z.array(z.string()),
  textPosition: z.enum(["top", "bottom"]),
  image: z.object({
    source: z.enum(["brand_image", "generated", "site_phone"]),
    /** brand image file name (brand_image, or the blurred backdrop of a site_phone slide); "" if none */
    file: z.string(),
    /** photoreal image prompt in English (generated, or a site_phone backdrop without a file); "" if none */
    prompt: z.string(),
  }),
  /** customer words quoted on this slide, copied exactly from evidence text; [] if none */
  quotes: z.array(z.object({ evidenceId: z.string(), quote: z.string() })),
});
const Script = z.object({
  pattern: z.string(),
  why: z.string(),
  slides: z.array(Slide),
  caption: z.string(),
  hashtags: z.array(z.string()),
});
type Script = z.infer<typeof Script>;

const SYSTEM = `You write one Instagram carousel / TikTok photo-mode post for a real brand. It is a remake of a proven winning carousel structure, not a copy of anyone's creative.

Structure (exactly 6 slides):
1. Hook: names the persona's pain in a few words (max ~8 words), so the right person stops scrolling.
2-5. One idea per slide, with slide-to-slide tension so people swipe: either myth vs fact, or numbered steps. Each slide earns the next.
6. CTA: one clear next step with the real site (${site}). Nothing salesy or pushy.

Rules:
- All on-slide copy (headline, body, caption, hashtags) is in ${LANG_NAME[language] ?? language}, written natively by a local social copywriter: idiomatic, natural, not a word-for-word translation of English. Correct diacritics. Sentence case, no ALL CAPS.
- Headline max ~9 words. body: 0 to 2 short lines, each max ~10 words. accentWord: exactly one word copied verbatim from that slide's headline (the key word).
- Ground every claim in the brand dossier (positioning, personas, proof, claimsAllowed). Never use anything in claimsForbidden. Never invent numbers, statistics, results, reviews or testimonials. Quote customer words only if they appear verbatim in the evidence text, and list them in quotes with the evidence id; otherwise quotes is [].
- Follow the brand's compliance rules strictly. Health brands: no drug or medicine names, no promised outcomes (no "lose X kg", no guarantees), no before/after bodies, no diagnosis claims; say screening / guidance / support, and for DNA reports that the report does not diagnose.
- No em dashes. Plain, specific, human.
- Images (full-bleed 4:5 backgrounds, the type sits on a dark gradient at textPosition):
  - brand_image: one of the attached real brand images, by exact file name, only where it works as a full-bleed photo background (illustrations and wide banners usually do not; product photos and portrait photos can).
  - site_phone: the real ${site} site shown on a phone (we screenshot it). Exactly one slide must be site_phone, and it must be slide 2 or 3, so the real product shows early. For its backdrop give a brand image file or a photoreal prompt (it is blurred behind the phone).
  - generated: a photoreal prompt (English) for a candid iPhone photo that matches the slide: real people and places, natural light, no text, no logos, no screens with UI, no medical procedures, no bodies shown as before/after, no needles, pens or pill packs. Keep the area where the type sits calm.
  - Slide 6 background: a calm photo (brand image or generated); the logo and URL are added on top.
- caption: 1 to 3 short sentences for the post, plus a soft CTA. hashtags: 3 to 6, local.
- pattern: name the winning structure you remade (from the evidence hooks/formats when there is one). why: one sentence.`;

async function writeScript(feedback?: string): Promise<Script> {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: JSON.stringify({
        dossier: grounding,
        evidence: evItems,
        brandImageFiles: files,
        ...(feedback ? { complianceFeedback: feedback } : {}),
      }),
    },
  ];
  for (const f of files.slice(0, 16)) {
    const thumb = await sharp(path.join(brandAssetsDir(), slug!, f))
      .flatten({ background: "#FFFFFF" })
      .resize(256, 256, { fit: "inside" })
      .jpeg({ quality: 70 })
      .toBuffer();
    content.push({ type: "text", text: `Brand image: ${f}` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: thumb.toString("base64") },
    });
  }
  if (feedback)
    content.push({
      type: "text",
      text: `The previous version failed compliance. Fix every finding: ${feedback}`,
    });
  const r = await structured(
    { db, runId, phase: "production" },
    {
      route: "production",
      system: SYSTEM,
      user: content,
      schema: Script,
      note: `carousel: script for ${slug}`,
      maxTokens: 12000,
      demo: () => {
        throw new Error("carousel needs live Claude (demo mode)");
      },
    },
  );
  return r.value;
}

/** structural guarantees the model may miss: 6 slides, CTA last, one site_phone on slide 2 or 3, real files only */
function fixUp(s: Script): Script {
  let slides = s.slides.slice(0, 6);
  slides = slides.map((x) => {
    const okFile = files.includes(x.image.file);
    const image = { ...x.image, file: okFile ? x.image.file : "" };
    if (image.source === "brand_image" && !okFile) image.source = "generated";
    return { ...x, image };
  });
  const phoneIdx = slides.findIndex((x) => x.image.source === "site_phone");
  if (phoneIdx !== 1 && phoneIdx !== 2) {
    if (phoneIdx >= 0)
      slides[phoneIdx] = { ...slides[phoneIdx]!, image: { ...slides[phoneIdx]!.image, source: "generated" } };
    slides[2] = { ...slides[2]!, image: { ...slides[2]!.image, source: "site_phone" } };
  }
  slides[slides.length - 1] = { ...slides.at(-1)!, role: "cta" };
  return { ...s, slides };
}

const scriptText = (s: Script) =>
  [
    `Pattern: ${s.pattern}`,
    ...s.slides.map(
      (x, i) =>
        `Slide ${i + 1} (${x.role}): ${x.headline}${x.body.length ? ` | ${x.body.join(" / ")}` : ""} | image: ${x.image.source}${x.image.file ? ` ${x.image.file}` : ""}${x.image.prompt ? ` prompt: ${x.image.prompt}` : ""}`,
    ),
    `Caption: ${s.caption}`,
    `Hashtags: ${s.hashtags.join(" ")}`,
    `CTA: ${site}`,
  ].join("\n");

log("script", slug, language, `evidence=${evItems.length}`, `run=${runId ?? "none"}`);
let script = fixUp(await writeScript());
let cc = await checkText(db, {
  brand,
  text: scriptText(script),
  targetType: "concept",
  targetId: `carousel_${slug}`,
  runId,
});
const complianceHistory = [{ attempt: 0, status: cc.status, findings: cc.findings }];
log("compliance", cc.status, cc.findings.map((f) => `${f.severity}:${f.ruleId}`).join(" "));
if (cc.status === "fail") {
  const fb = cc.findings
    .filter((f) => f.severity !== "info")
    .map((f) => `[${f.severity} ${f.ruleId}] ${f.message}${f.excerpt ? ` (excerpt: "${f.excerpt}")` : ""}`)
    .join("; ");
  script = fixUp(await writeScript(fb));
  cc = await checkText(db, {
    brand,
    text: scriptText(script),
    targetType: "concept",
    targetId: `carousel_${slug}`,
    runId,
    attempt: 1,
  });
  complianceHistory.push({ attempt: 1, status: cc.status, findings: cc.findings });
  log("compliance (retry)", cc.status, cc.findings.map((f) => `${f.severity}:${f.ruleId}`).join(" "));
}
if (cc.status === "fail") {
  fs.writeFileSync(
    path.join(outDir, "carousel.json"),
    JSON.stringify({ brand: slug, language, script, compliance: complianceHistory, rendered: false }, null, 2),
  );
  console.error("compliance failed twice: not rendering");
  process.exit(2);
}

// quotes must be verbatim in the evidence
const quoteCheck = script.slides.flatMap((x, i) =>
  x.quotes.map((q) => {
    const ev = evidence.find((e) => e.id === q.evidenceId);
    return { slide: i + 1, ...q, verbatim: !!ev?.text?.includes(q.quote) };
  }),
);

// ---------------------------------------------------------------- images

const STILL =
  "Photoreal vertical photo, shot on an iPhone, natural light, real lived-in setting, candid framing, true-to-life colours, subtle grain, no text, no letters, no logos, no watermark, not glossy, not CGI, not a stock photo.";
const imgSource: string[] = [];
async function bgFor(i: number, promptOverride?: string): Promise<string> {
  const x = script.slides[i]!;
  if (!promptOverride && x.image.file && (x.image.source === "brand_image" || x.image.source === "site_phone")) {
    imgSource[i] = x.image.file;
    return path.join(brandAssetsDir(), slug!, x.image.file);
  }
  const zone =
    x.image.source === "site_phone"
      ? ""
      : x.textPosition === "top"
        ? "Keep the top 40% of the frame calm and simple."
        : "Keep the bottom 45% of the frame calm and simple.";
  const prompt = `${promptOverride ?? x.image.prompt}. ${STILL} ${zone}`;
  const out = path.join(work, `bg_${i + 1}${promptOverride ? "_v2" : ""}.png`);
  const color = brand!.dossier.visual.colors[0] ?? "#888888";
  const g = await generateImage(db, prompt, {
    runId,
    quality: "high",
    size: "1024x1536",
    demo: () =>
      sharp({ create: { width: 1024, height: 1536, channels: 3, background: color } })
        .png()
        .toBuffer(),
  });
  fs.writeFileSync(out, g.png);
  imgSource[i] = g.mode === "live" ? "generated" : "generated (demo placeholder)";
  return out;
}
log("images");
const bgs: string[] = new Array(script.slides.length);
const queue = script.slides.map((_, i) => i);
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) bgs[i] = await bgFor(i);
  }),
);

const toSlides = (): CarouselSlide[] =>
  script.slides.map((x, i) => ({
    headline: x.headline,
    accentWord: x.accentWord,
    body: x.body,
    bg: bgs[i]!,
    textPosition: x.textPosition,
    phone: x.image.source === "site_phone" ? shot : undefined,
    cta: i === script.slides.length - 1 ? { url: site } : undefined,
  }));
log("render");
let result = await renderCarousel(toSlides(), brand, outDir);

// ---------------------------------------------------------------- review

const Review = z.object({
  slides: z.array(
    z.object({
      slide: z.number(),
      legibility: z.number(),
      nativeFeel: z.number(),
      hookStrength: z.number(),
      overall: z.number(),
      issues: z.string(),
      /** a better photoreal prompt for this slide's background, in English, if the image is the problem; "" if not */
      betterImagePrompt: z.string(),
    }),
  ),
  productVisibleSlide: z.number(),
  productVisibleBeforeLast40: z.boolean(),
  ctaOnLastSlide: z.boolean(),
  gatePass: z.boolean(),
  notes: z.string(),
});
type Review = z.infer<typeof Review>;
async function review(): Promise<Review> {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: `Brand: ${brand!.name} (${site}). Language: ${LANG_NAME[language]}. ${script.slides.length} slides, 1080x1350, in order. Slide copy: ${JSON.stringify(script.slides.map((x) => ({ headline: x.headline, body: x.body })))}`,
    },
  ];
  for (const [i, s] of result.slides.entries()) {
    const jpg = await sharp(s.file).resize(540, 675).jpeg({ quality: 82 }).toBuffer();
    content.push({ type: "text", text: `Slide ${i + 1}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") } });
  }
  const r = await structured(
    { db, runId, phase: "review" },
    {
      route: "vision",
      system: `You are a strict creative director for Instagram carousels and TikTok photo mode. Score each slide 0 to 100 on: legibility (type readable at phone size over the image), nativeFeel (looks like a real creator/brand post, no AI tells: warped hands, plastic skin, nonsense text, uncanny faces, stock-photo gloss), hookStrength (does it make you swipe; slide 1 matters most), and overall. Be honest and calibrated: 85+ only if it would hold up next to top posts in the feed. Hard gate: the real product (the brand's site/app on a phone, its real kit or product photo) is clearly visible on a slide before the last 40% of the carousel (for 6 slides: slide 1, 2 or 3), AND the CTA with the site is on the last slide. gatePass = both true. productVisibleSlide = first slide number where the real product is visible (0 if none). For a slide whose background image is the problem, give betterImagePrompt (photoreal, English, no text, no logos); else "". No em dashes.`,
      user: content,
      schema: Review,
      note: `carousel: review ${slug}`,
      maxTokens: 8000,
      demo: () => {
        throw new Error("review needs live Claude");
      },
    },
  );
  return r.value;
}
log("review");
const reviews: (Review & { round: number })[] = [];
let rv = await review();
reviews.push({ ...rv, round: 1 });
log("review 1", rv.slides.map((s) => s.overall).join(","), `gate=${rv.gatePass}`, `product@${rv.productVisibleSlide}`);
const weakest = [...rv.slides].sort((a, b) => a.overall - b.overall)[0];
let regenerated: { slide: number; from: string; prompt: string } | null = null;
if (weakest && weakest.overall < 70) {
  const i = weakest.slide - 1;
  const x = script.slides[i];
  if (x && x.image.source !== "site_phone") {
    const prompt =
      weakest.betterImagePrompt ||
      `${x.image.prompt || `A calm, candid photo that fits: ${x.headline}`}. Avoid: ${weakest.issues}`;
    log("regenerate slide", weakest.slide, "image");
    const from = imgSource[i] ?? "";
    bgs[i] = await bgFor(i, prompt);
    regenerated = { slide: weakest.slide, from, prompt };
    result = await renderCarousel(toSlides(), brand, outDir);
    rv = await review();
    reviews.push({ ...rv, round: 2 });
    log("review 2", rv.slides.map((s) => s.overall).join(","), `gate=${rv.gatePass}`);
  }
}

// ---------------------------------------------------------------- carousel.json

const json = {
  brand: slug,
  brandName: brand.name,
  site,
  language,
  size: { width: CW, height: CH },
  pattern: script.pattern,
  why: script.why,
  runId: runId ?? null,
  evidenceUsed: evItems.length,
  slides: script.slides.map((x, i) => ({
    n: i + 1,
    role: x.role,
    headline: x.headline,
    accentWord: x.accentWord,
    body: x.body,
    image: {
      source: x.image.source,
      file: imgSource[i] ?? null,
      prompt: x.image.prompt || null,
      phoneScreenshot: x.image.source === "site_phone" ? `${brand.url} (live screenshot, phone viewport)` : null,
    },
    png: `slide_${i + 1}.png`,
  })),
  quotes: quoteCheck,
  caption: script.caption,
  hashtags: script.hashtags,
  accent: result.accent,
  compliance: { status: cc.status, rulePack: cc.rulePack, history: complianceHistory },
  review: { final: rv, rounds: reviews, regenerated },
  strip: "strip.jpg",
  minutes: Math.round((Date.now() - t0) / 600) / 100,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, "carousel.json"), JSON.stringify(json, null, 2));
log("done", outDir);
console.log(
  JSON.stringify({
    slug,
    language,
    compliance: cc.status,
    scores: rv.slides.map((s) => s.overall),
    gate: rv.gatePass,
    regenerated: regenerated?.slide ?? null,
  }),
);
process.exit(0);
