import type { Run } from "../../entities";
import { evreon as brand } from "../brands";
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

/** DEMO DATA (demo: true). Placeholder authors; no real customers, logos or quotes. */
const runId = "run_evreon_demo";

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
    title: "evreonai.com: agents for reception, intake, records, billing; '0 diagnoses made. By design.'",
    url: "https://evreonai.com",
    text: "Book a 20-minute demo. EU data residency, 50+ languages, every output traceable to its source.",
    tags: ["own-site"],
  },
  {
    n: 2,
    source: "manus_research",
    kind: "research",
    title: "Manus: how private clinics in HU, GB, DE buy admin software",
    text: "Practice managers and owners decide; discovery through LinkedIn, peer referrals, practice-manager associations and conferences. Short demos and traceability reduce perceived AI risk.",
    tags: ["research", "b2b", "landscape"],
  },
  {
    n: 3,
    source: "youtube",
    kind: "video",
    title: "Founder explains why their clinic AI never diagnoses",
    author: "Demo HealthTech Founder",
    m: { views: 48_000, likes: 1_200, comments: 140, followers: 9_000, outlierScore: 6.1 },
    d: { hook: "Our AI makes zero diagnoses. On purpose.", format: "founder_story", lengthSec: 55, language: "en" },
    tags: ["founder-led", "trust", "outlier"],
  },
  {
    n: 4,
    source: "reddit",
    kind: "thread",
    title: "r/medicine: 'AI scribes and intake tools: anyone actually happy?'",
    author: "u/demo_user_md",
    text: "Clinicians want source links and no hallucinated diagnoses; admin time is the pain.",
    m: { likes: 300, comments: 210 },
    tags: ["voice-of-customer", "objection"],
  },
  {
    n: 5,
    source: "reddit",
    kind: "thread",
    title: "r/practicemanagement: 'Front desk drowning in calls'",
    author: "u/demo_user_pm",
    text: "Phone volume and rescheduling chaos are the daily pain for practice managers.",
    m: { likes: 85, comments: 60 },
    tags: ["voice-of-customer", "reception"],
  },
  {
    n: 6,
    source: "spiral",
    kind: "research",
    title: "Spiral: B2B healthtech ads in EU are mostly LinkedIn-style demo videos",
    text: "Meta and TikTok creatives for clinic software are rare and short-lived; demo walkthroughs dominate.",
    tags: ["paid", "b2b"],
  },
  {
    n: 7,
    source: "meta_ad_library",
    kind: "ad",
    title: "Clinic software ad: 'Cut admin time' product walkthrough",
    author: "Demo competitor clinic software",
    m: { daysRunning: 8 },
    d: { hook: "Your front desk, on autopilot", format: "product_demo", lengthSec: 30, language: "en" },
    tags: ["testing", "paid"],
  },
  {
    n: 8,
    source: "manus_research",
    kind: "research",
    title: "Manus: practice-manager communities and newsletters in GB and DE",
    text: "Practice-manager associations, regional GP networks, healthcare ops newsletters; conferences in Q4.",
    tags: ["communities", "research"],
  },
  {
    n: 9,
    source: "tiktok",
    kind: "video",
    title: "Doctor humor about paperwork (consumer audience)",
    author: "@demo_doc_humor",
    m: { views: 900_000, likes: 120_000, followers: 1_200_000, outlierScore: 0.8 },
    d: { hook: "Me after 3 hours of paperwork", format: "ugc_talking_head", lengthSec: 12, language: "en" },
    text: "Big reach, but the audience is consumers and students, not clinic buyers.",
    tags: ["wrong-audience"],
  },
  {
    n: 10,
    source: "youtube",
    kind: "video",
    title: "60-second demo: AI intake in the patient's language",
    author: "Demo Clinic Tools",
    m: { views: 12_000, likes: 300, followers: 4_000, outlierScore: 3.0 },
    d: {
      hook: "The patient speaks Turkish. The doctor reads English.",
      format: "product_demo",
      lengthSec: 60,
      language: "en",
    },
    tags: ["demo", "multilingual"],
  },
];

const Q: QSpec[] = [
  {
    kind: "single",
    prompt: "Who should we reach first?",
    why: "The site lists private practices first, then multi-doctor clinics; the research shows owners and practice managers decide (ev 02).",
    ev: [1, 2],
    options: [
      ["private", "Private practices"],
      ["multi", "Multi-doctor clinics"],
      ["hospitals", "Hospitals"],
    ],
    def: "private",
    fills: "personas.primary",
  },
  {
    kind: "confirm",
    prompt: "Will the founder post on LinkedIn 3 times a week?",
    why: "Founder-led explanations of 'never diagnoses' are the strongest trust content in the category (ev 03).",
    ev: [3],
    def: true,
    fills: "assets.founderOnCamera",
  },
  {
    kind: "text",
    prompt: "Do you have any customer or pilot we are allowed to name?",
    why: "There are no logos or case studies on the site, and rule E2 forbids naming customers without permission.",
    ev: [1],
    def: "Not yet. No names.",
    required: false,
    fills: "proof",
  },
  {
    kind: "single",
    prompt: "Which country first?",
    why: "Offices are in Budapest and London; DE is listed as early. Language and community lists differ per country.",
    ev: [2, 8],
    options: [
      ["gb", "UK"],
      ["hu", "Hungary"],
      ["de", "Germany"],
    ],
    def: "gb",
    fills: "markets.first",
  },
];

const concepts: ConceptSpec[] = [
  {
    channel: "linkedin",
    format: "text_post",
    title: "0 diagnoses made. By design.",
    hook: "Our clinic AI has made 0 diagnoses. That is the point.",
    angle: "Founder explains the design choice that makes AI safe at the front desk",
    language: "en",
    shots: [],
    caption: "Founder post for LinkedIn.",
    hashtags: ["#healthtech", "#practicemanagement"],
    cta: "Book a 20-minute demo",
    remakes: [3, 4],
    remakeNote:
      "Founder-led trust structure from the strongest healthtech video; written fresh for Evreon with no accuracy claims.",
    body: "Every week someone asks how accurate our diagnoses are. The answer: we make none. Evreon's agents book, take histories in the patient's language, file records with a link to the source page, and handle billing. The doctor decides. That design choice is why clinics let us near their front desk.",
  },
  {
    channel: "linkedin",
    format: "product_demo",
    title: "The patient speaks Turkish. The doctor reads English.",
    hook: "The patient speaks Turkish. The doctor reads English. Nothing is lost.",
    angle: "Show intake in the patient's language with source links",
    language: "en",
    shots: [
      [
        4,
        "Clean UI mock: intake form in Turkish on a phone, oxblood accents, off-white",
        "Intake in the patient's language",
      ],
      [4, "Doctor's screen: summary in English with source links highlighted", "Every line links to its source"],
      [4, "Scanned foreign-language document being filed with a link", "Records, filed and traceable"],
      [3, "Evreon end card: 0 diagnoses made. By design.", "Book a 20-minute demo"],
    ],
    caption: "Intake in 50+ languages, every line linked to its source, and no diagnoses. Book a 20-minute demo.",
    hashtags: ["#healthtech", "#clinics", "#gdpr"],
    cta: "Book a 20-minute demo",
    remakes: [10],
    remakeNote: "Uses the multilingual demo structure; visuals are Evreon UI mocks, no real patient data.",
  },
];

const evidence = makeEvidence(brand, runId, E);
const questions = makeQuestions(brand, runId, Q, true);
const plan = makePlan(
  brand,
  runId,
  "B2B: lead with founder-led LinkedIn and targeted outbound to practice managers in the UK, then communities of practice managers. TikTok and Instagram reach consumers, not clinic buyers.",
  [
    {
      channel: "linkedin",
      s: [90, 75, 85, 90, 70, 95],
      mode: "organic",
      rationale:
        "Owners and practice managers discover admin software on LinkedIn and through peers; founder-led trust content is the strongest format in the category.",
      ev: [2, 3, 10],
      formats: ["founder text posts", "60 s product demos"],
      cadence: "3 founder posts per week",
      firstSteps: ["Post '0 diagnoses' story", "Connect with 50 UK practice managers", "Share the multilingual demo"],
      kpis: ["Demo bookings", "Profile views from clinic staff"],
      targets: ["UK practice managers", "private practice owners", "GP partners"],
    },
    {
      channel: "email",
      s: [70, 60, 80, 85, 80, 90],
      mode: "organic",
      rationale: "A 20-minute demo is a clear, low-friction ask for targeted outbound to practice managers.",
      ev: [2, 5],
      formats: ["3-step outbound sequence"],
      cadence: "30 new contacts per week",
      firstSteps: ["Build a list of 100 UK private practices", "Write a 3-email sequence around front-desk calls"],
      kpis: ["Reply rate", "Demos booked"],
      targets: ["UK private practices"],
    },
    {
      channel: "communities",
      s: [75, 50, 70, 85, 50, 85],
      mode: "organic",
      rationale: "Practice-manager associations and newsletters reach the buyer directly; slow but high trust.",
      ev: [5, 8],
      formats: ["guest posts", "webinar"],
      cadence: "1 community action per week",
      firstSteps: ["List 10 practice-manager communities", "Offer a 'cut phone chaos' webinar"],
      kpis: ["Leads per community"],
      targets: ["practice-manager associations", "healthcare ops newsletters"],
    },
    {
      channel: "seo",
      s: [55, 40, 80, 90, 30, 75],
      mode: "organic",
      rationale: "Long-cycle buyers research; answer 'AI intake GDPR' style questions.",
      ev: [4],
      formats: ["explainer articles"],
      cadence: "1 article per week",
      firstSteps: ["Write 'Is AI intake GDPR compliant in the EU?'"],
      kpis: ["Organic demo requests"],
      targets: ["AI intake", "clinic reception software"],
    },
  ],
  [
    {
      channel: "tiktok",
      reason: "Huge doctor-humor reach, but the audience is consumers and students, not clinic buyers.",
      ev: [9],
      s: [20, 30, 50, 80, 60, 15],
    },
    {
      channel: "instagram_reels",
      reason: "Consumer audience; clinic buyers do not discover software there.",
      ev: [9, 6],
      s: [20, 20, 60, 80, 50, 20],
    },
    {
      channel: "meta_ads",
      reason:
        "B2B clinic software ads on Meta are rare and short-lived (8 days); weak targeting for practice managers.",
      ev: [6, 7],
      s: [30, 20, 60, 70, 40, 30],
    },
  ],
);
const conceptsOut = makeConcepts(brand, runId, concepts);
const compliance = makeCompliance(brand, conceptsOut);
const packs = makePacks(brand, runId, conceptsOut);
const connections = makeConnections(brand, ["firecrawl", "youtube"], ["apify", "manus"], ["stripe", "posthog"]);

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
export const evreonDemo: DemoRunBundle = { ...base, events: buildEvents(base) };
