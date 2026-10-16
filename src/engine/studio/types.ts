import { z } from "zod";

/**
 * Ad Studio contracts: statics and carousels for paid social (Meta first), built from what already wins in the
 * brand's market. Everything here is stored as JSON in the studio tables (see db/schema.ts).
 */

export const ASPECTS = ["4:5", "1:1", "9:16"] as const;
export type Aspect = (typeof ASPECTS)[number];
export const SIZE: Record<Aspect, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

export const IMAGE_MODELS = [
  "openai:gpt-image-2",
  "fal:gpt-image-2.5-flare",
  "fal:nano-banana-pro",
  "fal:nano-banana-2.1",
  "fal:seedream-5-lite",
] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

export const Competitor = z.object({
  name: z.string(),
  website: z.string().optional(),
  /** what to type into the Meta Ad Library search (usually the page name) */
  adLibraryQuery: z.string(),
  /** the Facebook page id, when known (exact advertiser match) */
  pageId: z.string().optional(),
  why: z.string().optional(),
});
export type Competitor = z.infer<typeof Competitor>;

export const Testimonial = z.object({ text: z.string(), author: z.string().optional(), source: z.string() });

/** Per-brand studio config (studio_kv key `brand:<brandId>`). Everything the operator can change by chat or UI. */
export const StudioBrandConfig = z.object({
  countries: z.array(z.string()),
  languages: z.array(z.string()),
  /** language the ads are written in unless a request says otherwise */
  defaultLanguage: z.string(),
  competitors: z.array(Competitor),
  /** category keywords for the ad library (e.g. "weight loss doctor", "dog training app") */
  searchTerms: z.array(z.string()),
  placement: z.enum(["paid", "organic"]),
  imageModel: z.enum(IMAGE_MODELS),
  aspects: z.array(z.enum(ASPECTS)),
  /** asset URLs (/api/assets/...) of the logo, a light version for dark backgrounds, and real brand images */
  logo: z.string().optional(),
  logoOnDark: z.string().optional(),
  /** wordmark: the brand name set in type instead of a logo image (for text logos like "a.clinic") */
  logoStyle: z.enum(["image", "wordmark"]).optional(),
  brandImages: z.array(z.object({ url: z.string(), note: z.string().optional() })),
  /** a phone screenshot of the product (site or app) */
  productShot: z.string().optional(),
  colors: z.object({ primary: z.string(), accent: z.string(), ink: z.string(), paper: z.string() }),
  fonts: z.object({ head: z.string(), body: z.string() }),
  /** standing instructions from the operator ("never show a doctor's face", "always say 'from 49 EUR'") */
  notes: z.array(z.string()),
  /** real customer words the operator provided (the only testimonials ads may quote) */
  testimonials: z.array(Testimonial),
  /** the offer to push, if any ("first consultation 29 EUR") */
  offer: z.string().optional(),
  /** lines that must appear (e.g. "Not veterinary advice.") */
  disclaimers: z.array(z.string()),
  /** the landing URL shown on CTA slides */
  ctaUrl: z.string(),
});
export type StudioBrandConfig = z.infer<typeof StudioBrandConfig>;

// ---------------------------------------------------------------- competitor ads

export const RefAnalysis = z.object({
  /** id from the format library (formats.ts), or "other" */
  format: z.string(),
  hook: z.string(),
  /** the visible headline or first line, verbatim */
  headline: z.string(),
  layout: z.string(),
  visualStyle: z.string(),
  angle: z.string(),
  persona: z.string(),
  emotion: z.string(),
  offer: z.string(),
  cta: z.string(),
  whyItWins: z.string(),
  /** the structure worth reusing, in one or two sentences (never the creative itself) */
  steal: z.string(),
  avoid: z.string(),
  /** carousel: what each card does, in order */
  slides: z.array(z.string()),
  /** 0 to 100: how strong this ad is as a reference */
  strength: z.number(),
  /** true when it is not a relevant reference (wrong market, job ad, unrelated product) */
  irrelevant: z.boolean(),
});
export type RefAnalysis = z.infer<typeof RefAnalysis>;

export interface AdRefBody {
  adLibraryUrl?: string;
  pageName: string;
  pageId?: string;
  competitor?: string;
  country: string;
  query: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  daysRunning?: number;
  /** ads sharing this creative (Meta's collation count): scaled creatives show up many times */
  variants?: number;
  platforms: string[];
  displayFormat?: string;
  title?: string;
  body?: string;
  linkUrl?: string;
  cta?: string;
  /** image files on our disk (asset URLs), for analysis and the reference grid only; never reused */
  images: string[];
  cards: { title?: string; body?: string; image?: string }[];
  analysis?: RefAnalysis;
}

export interface AdRef {
  id: string;
  brandId: string;
  source: string;
  externalId: string;
  advertiser: string;
  /** video_cover: the cover frame of a video ad (the static hook people see first) */
  mediaType: "image" | "carousel" | "video_cover";
  score: number;
  body: AdRefBody;
  createdAt: string;
}

export const Playbook = z.object({
  summary: z.string(),
  patterns: z.array(
    z.object({
      name: z.string(),
      format: z.string(),
      share: z.string(),
      refIds: z.array(z.string()),
      why: z.string(),
      howWeUseIt: z.string(),
    }),
  ),
  angles: z.array(z.object({ angle: z.string(), evidence: z.string(), forUs: z.string() })),
  whiteSpace: z.array(z.string()),
  visualNorms: z.string(),
  copyNorms: z.string(),
  doNot: z.array(z.string()),
});
export type Playbook = z.infer<typeof Playbook> & { createdAt: string; refCount: number };

// ---------------------------------------------------------------- generated ads

export const TEMPLATES = [
  "photo_headline",
  "split_panel",
  "checklist",
  "comparison",
  "quote_card",
  "notes_app",
  "post_card",
  "stat",
  "myth_fact",
  "offer_card",
  "text_slide",
  "cta_end",
  "ugc_caption",
  "letter",
  "quiz",
  "sticky",
  "steps",
  "native",
] as const;
export type TemplateId = (typeof TEMPLATES)[number];

/** Everything a template can draw. Each template uses the slots it needs and ignores the rest. */
export const Slots = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  /** one or two words of the headline drawn in the accent colour */
  accentWord: z.string(),
  body: z.string(),
  bullets: z.array(z.string()),
  /** comparison: rows of [label, us, them]; us/them are short ("Yes", "No", "From 49 EUR") */
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
export type Slots = z.infer<typeof Slots>;

export interface SlideImage {
  /** generated: a model made it; brand: a real brand image; product: the phone screenshot; none */
  source: "generated" | "brand" | "product" | "none";
  prompt?: string;
  model?: string;
  /** asset URL of the image used (background or inset) */
  url?: string;
  usd?: number;
}

export interface Slide {
  template: TemplateId;
  slots: Partial<Slots>;
  image: SlideImage;
  /** asset URL of the rendered PNG */
  png?: string;
}

export interface AdReview {
  overall: number;
  stopPower: number;
  clarity: number;
  brandFit: number;
  craft: number;
  /** text in the image reads exactly as intended (native renders) */
  textCorrect: boolean;
  issues: string[];
  fix: string;
  slideScores: number[];
}

export interface AdBody {
  title: string;
  angle: string;
  persona: string;
  rationale: string;
  /** competitor refs this remakes the structure of */
  inspiredBy: string[];
  language: string;
  aspect: Aspect;
  placement: "paid" | "organic";
  copy: { primaryText: string; headline: string; description: string; cta: string };
  slides: Slide[];
  compliance?: { status: "pass" | "warn" | "fail"; findings: { ruleId: string; severity: string; message: string }[] };
  review?: AdReview;
  feedback: { at: string; text: string }[];
  versions: { at: string; slides: Slide[]; review?: AdReview }[];
  costUsd: number;
  error?: string;
}

export type AdStatus = "queued" | "rendering" | "ready" | "below_bar" | "approved" | "rejected" | "failed";

export interface Ad {
  id: string;
  brandId: string;
  batchId: string;
  format: string;
  kind: "static" | "carousel";
  status: AdStatus;
  score: number | null;
  body: AdBody;
  createdAt: string;
  updatedAt: string;
}

export type JobKind = "setup" | "scan" | "analyze" | "generate" | "revise" | "autopilot";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface Job {
  id: string;
  brandId: string | null;
  kind: JobKind;
  status: JobStatus;
  step: string | null;
  progress: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  log: { ts: string; msg: string }[];
  error: string | null;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
}
