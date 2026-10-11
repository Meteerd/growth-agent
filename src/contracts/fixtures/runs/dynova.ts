import type { Run } from "../../entities";
import { dynova as brand } from "../brands";
import {
  buildEvents,
  type ConceptSpec,
  type DemoRunBundle,
  type EvSpec,
  iso,
  makeCompliance,
  makeConcepts,
  makeConnections,
  makeEvidence,
  makePacks,
  makePlan,
  makeQuestions,
  type QSpec,
} from "../builder";

/** DEMO DATA (demo: true). Placeholder authors; not real accounts. */
const runId = "run_dynova_demo";

const run: Run = {
  id: runId,
  brandId: brand.id,
  kind: "full",
  status: "done",
  phase: "pack",
  costUsd: 0,
  startedAt: iso(0),
  finishedAt: iso(700),
  demo: true,
  dataset: "demo",
  createdAt: iso(0),
};

const E: EvSpec[] = [
  {
    n: 1,
    source: "website",
    kind: "page",
    title: "dynova.health: genetic test, personalized supplements, skin analysis",
    url: "https://dynova.health",
    text: "Personal health decisions based on your own data. Reports are informational and do not replace medical diagnosis.",
    tags: ["own-site"],
  },
  {
    n: 2,
    source: "instagram",
    kind: "video",
    title: "Unboxing an at-home DNA kit: what's inside (TR)",
    author: "@demo_saglik_tr",
    m: { views: 320_000, likes: 18_000, comments: 700, followers: 40_000, outlierScore: 8.0 },
    d: { hook: "Evde DNA testi: kutudan ne çıkıyor?", format: "product_demo", lengthSec: 25, language: "tr" },
    tags: ["unboxing", "outlier"],
  },
  {
    n: 3,
    source: "instagram",
    kind: "video",
    title: "Dietitian reads a genetic nutrition report (TR)",
    author: "@demo_diyetisyen",
    m: { views: 210_000, likes: 12_000, comments: 900, followers: 60_000, outlierScore: 3.5 },
    d: {
      hook: "Genlerin ne yemen gerektiğini söylüyor mu?",
      format: "ugc_talking_head",
      lengthSec: 40,
      language: "tr",
    },
    tags: ["expert", "report"],
  },
  {
    n: 4,
    source: "tiktok",
    kind: "video",
    title: "Why the same diet works for my friend and not for me",
    author: "@demo_wellness_tr",
    m: { views: 480_000, likes: 40_000, comments: 1_800, followers: 35_000, outlierScore: 13.7 },
    d: {
      hook: "Aynı diyet arkadaşıma yaradı, bana yaramadı. Neden?",
      format: "founder_story",
      lengthSec: 30,
      language: "tr",
    },
    tags: ["personalization", "outlier"],
  },
  {
    n: 5,
    source: "youtube",
    kind: "video",
    title: "Skin analysis from a selfie: does it work? #shorts",
    author: "Demo Beauty Lab",
    m: { views: 150_000, likes: 6_000, followers: 80_000, outlierScore: 1.9 },
    d: { hook: "I let an app analyse my skin from one photo", format: "product_demo", lengthSec: 45, language: "en" },
    tags: ["beauty"],
  },
  {
    n: 6,
    source: "meta_ad_library",
    kind: "ad",
    title: "Supplement ad claiming to 'prevent' illness (TR)",
    author: "Demo supplement brand",
    m: { daysRunning: 6 },
    text: "Disease-prevention claims for supplements are a compliance risk (rule T2).",
    tags: ["non-compliant"],
  },
  {
    n: 7,
    source: "meta_ad_library",
    kind: "ad",
    title: "Personalized vitamins ad: 'built from your answers' (TR)",
    author: "Demo personalized vitamins brand",
    m: { daysRunning: 44 },
    d: { hook: "Sana özel vitamin paketi", format: "static", angle: "Personalization", language: "tr" },
    tags: ["proven", "paid"],
  },
  {
    n: 8,
    source: "manus_research",
    kind: "research",
    title: "Manus: TR wellness DTC landscape",
    text: "Instagram is the main discovery channel for premium wellness in Turkey; dietitian creators are trusted; health-provider advertising is restricted.",
    tags: ["research", "landscape"],
  },
  {
    n: 9,
    source: "reddit",
    kind: "thread",
    title: "r/Turkey: 'Are DNA diet tests worth it?'",
    author: "u/demo_user_tr",
    text: "Skeptical: people want to know what is actionable and what happens to their data.",
    m: { likes: 60, comments: 45 },
    tags: ["objection", "privacy"],
  },
];

const Q: QSpec[] = [
  {
    kind: "single",
    prompt: "Which line should lead for the next 30 days?",
    why: "Personalization stories are the biggest outliers (ev 04), but each line has different rules and audiences.",
    ev: [2, 4, 5],
    options: [
      ["health", "Dynova Health (DNA test)"],
      ["nutrition", "Dynova Nutrition"],
      ["beauty", "Dynova Beauty"],
    ],
    def: "health",
    fills: "offers.lead",
  },
  {
    kind: "confirm",
    prompt: "Can a Dynova dietitian appear on camera?",
    why: "Dietitian creators reading reports are trusted in TR wellness content (ev 03, 08).",
    ev: [3, 8],
    def: true,
    fills: "assets.expertOnCamera",
  },
  {
    kind: "text",
    prompt: "What can we say about data privacy (KVKK) in plain words?",
    why: "Privacy is the top objection (ev 09) and rule T3 forbids showing real customer data.",
    ev: [9],
    def: "Data is stored under KVKK and never sold.",
    fills: "claimsAllowed",
  },
];

const concepts: ConceptSpec[] = [
  {
    channel: "instagram_reels",
    format: "founder_story",
    title: "Aynı diyet, farklı sonuç (Same diet, different result)",
    hook: "Aynı diyet arkadaşıma yaradı, bana yaramadı.",
    angle: "Personal data explains why generic advice does not fit everyone",
    language: "tr",
    shots: [
      [
        3,
        "Two plates of the same meal on a bright table, soft warm sky light",
        "Aynı diyet",
        "Aynı diyet arkadaşıma yaradı, bana yaramadı.",
      ],
      [
        4,
        "Close-up of a saliva kit box on a marble counter, premium photography",
        "Neden?",
        "Çünkü herkesin verisi farklı.",
      ],
      [
        4,
        "Report screen with nutrition sections, no real names",
        "Kendi verin",
        "Dynova raporu kendi verinden bilgi verir.",
      ],
      [3, "Dynova end card", "Bilgilendirme amaçlıdır"],
    ],
    caption:
      "Genel tavsiyeler herkese uymaz. Dynova raporları bilgilendirme amaçlıdır, tıbbi teşhis veya tedavinin yerini tutmaz.",
    hashtags: ["#saglik", "#beslenme", "#dna", "#wellness"],
    cta: "dynova.health",
    remakes: [4, 2],
    remakeNote: "Personalization story arc from the top outlier; our own visuals and script; no medical claims.",
  },
  {
    channel: "instagram_reels",
    format: "product_demo",
    title: "Kutudan ne çıkıyor? (What's in the box)",
    hook: "Evde DNA testi: kutudan ne çıkıyor?",
    angle: "Demystify the kit; simple steps",
    language: "tr",
    shots: [
      [3, "Hands opening a premium white kit box", "Kutuyu aç"],
      [3, "Saliva tube and instructions card", "Örnek ver"],
      [3, "Courier envelope at a door", "Gönder"],
      [4, "Report on a phone with sections (nutrition, skin, aging)", "Raporunu oku"],
      [3, "Dynova end card", "dynova.health"],
    ],
    caption: "Dört adımda evde test. Raporlar bilgilendirme amaçlıdır.",
    hashtags: ["#dna", "#saglik", "#unboxing"],
    cta: "dynova.health",
    remakes: [2],
    remakeNote: "Unboxing structure; Dynova's own kit and photography style.",
  },
];

const evidence = makeEvidence(brand, runId, E);
const questions = makeQuestions(brand, runId, Q, true);
const plan = makePlan(
  brand,
  runId,
  "Instagram Reels first with personalization stories and unboxing, then TikTok and YouTube Shorts reuse. Every claim stays informational (T1, T2).",
  [
    {
      channel: "instagram_reels",
      s: [90, 75, 85, 70, 75, 85],
      mode: "organic",
      rationale:
        "Instagram is the main discovery channel for premium wellness in Turkey; unboxing and dietitian content outperform.",
      ev: [2, 3, 8],
      formats: ["unboxing", "dietitian explains", "personalization story"],
      cadence: "4 reels per week",
      firstSteps: ["Post the unboxing reel", "Dietitian reads a sample report", "Highlight: how the test works"],
      kpis: ["Saves", "Link clicks"],
      targets: ["#saglik", "#beslenme", "TR dietitian creators"],
    },
    {
      channel: "tiktok",
      s: [75, 85, 75, 65, 85, 70],
      mode: "organic",
      rationale: "The single biggest outlier is a TikTok personalization story (13.7x).",
      ev: [4],
      formats: ["personalization story"],
      cadence: "3 posts per week",
      firstSteps: ["Post the 'same diet' story"],
      kpis: ["Views vs median"],
      targets: ["TR wellness TikTok"],
    },
    {
      channel: "youtube_shorts",
      s: [55, 45, 75, 75, 60, 60],
      mode: "organic",
      rationale: "Beauty skin-analysis content works moderately; cheap reuse.",
      ev: [5],
      formats: ["product demo"],
      cadence: "2 per week",
      firstSteps: ["Repost reels"],
      kpis: ["Views"],
      targets: ["skin analysis"],
    },
  ],
  [
    {
      channel: "reddit",
      reason: "Turkish wellness buyers are barely on Reddit; skeptical threads only.",
      ev: [9],
      s: [15, 5, 50, 60, 40, 30],
    },
    { channel: "linkedin", reason: "Consumer product; LinkedIn adds little.", ev: [8], s: [15, 5, 60, 80, 40, 20] },
  ],
);
const conceptsOut = makeConcepts(brand, runId, concepts);
const compliance = makeCompliance(brand, conceptsOut);
const packs = makePacks(brand, runId, conceptsOut);
const connections = makeConnections(
  brand,
  ["firecrawl", "youtube"],
  ["apify", "manus"],
  ["stripe", "meta", "instagram"],
);

const base = {
  brand,
  run,
  connections,
  evidence,
  questions,
  plan,
  concepts: conceptsOut,
  compliance,
  packs,
  assets: [],
};
export const dynovaDemo: DemoRunBundle = { ...base, events: buildEvents(base) };
