import type { Brand } from "../entities";

/**
 * The four seeded brands. Dossiers v0 from docs/BRANDS.md (drafted 11 Oct 2026 from the live sites).
 * Seed data is real brand information (not demo metrics), so `demo: false`.
 * Colors were sampled from the brands' own logo files in assets/brands/.
 */

const SEEDED_AT = "2026-10-11T20:00:00.000Z";
const asset = (brand: string, file: string) => `/api/assets/brands/${brand}/${file}`;

export const BRAND_IDS = {
  aclinic: "brand_aclinic",
  hound: "brand_hound",
  dynova: "brand_dynova",
  evreon: "brand_evreon",
} as const;

export const aclinic: Brand = {
  id: BRAND_IDS.aclinic,
  slug: "aclinic",
  name: "a.clinic",
  url: "https://a.clinic",
  vertical: "telehealth_rx",
  countries: ["SK", "CZ"],
  languages: ["sk", "cs", "en"],
  rulePack: "eu_rx_telehealth",
  demo: false,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  dossier: {
    oneLiner: "Doctor-led online weight care in Slovakia and Czechia.",
    positioning:
      "Weight loss, done properly: medical oversight over quick fixes. A roughly 10-minute online medical questionnaire, a video consultation with a licensed doctor, a prescription (ePredpis in SK) only if the doctor decides it is appropriate, then ongoing check-ins with a care team. Medicine is paid at the pharmacy.",
    offers: [
      {
        name: "Online weight care program",
        notes:
          "Questionnaire, doctor video consultation, ePrescription if appropriate, care-team follow-up. Price shown in full before payment; cancel anytime.",
      },
      { name: "For doctors (B2B)", notes: "Partnership program for doctors who want to join the care team." },
    ],
    personas: [
      {
        name: "Busy professional, 30 to 50, who has tried diets before",
        pains: [
          "Tried diets and apps that did not stick",
          "No time for repeated clinic visits",
          "Feels judged in a waiting room",
        ],
        desires: ["A doctor who takes it seriously", "A plan that fits a working week", "Privacy"],
        objections: ["Is an online doctor a real doctor?", "What does it cost in total?", "Is this safe?"],
        whereTheyAre: ["Facebook groups", "Instagram", "Google search"],
      },
      {
        name: "Person with a weight-related health concern referred by a friend",
        pains: ["Worried about blood pressure or blood sugar", "Long waits for specialists"],
        desires: ["Medical oversight", "Follow-up, not a one-off"],
        objections: ["Will the doctor actually listen?", "Do I need to travel?"],
        whereTheyAre: ["Word of mouth", "Google search", "Health portals"],
      },
    ],
    voice: {
      tone: "Calm, reassuring, clinical yet approachable.",
      do: ["Lead with doctor-led care", "Explain the steps plainly", "Show the full price before payment"],
      dont: ["Promise kilos or timeframes", "Name any medicine", "Use before/after bodies", "Shame anyone's body"],
    },
    proof: [
      "Licensed doctors",
      "Official ePrescriptions",
      "Doctor-reviewed process",
      "Full price shown before payment",
      "Cancel anytime",
    ],
    claimsAllowed: [
      "Doctor-led online weight care",
      "Consultation from home, medicine from your local pharmacy",
      "Full price shown before you pay",
      "Ongoing support and check-ins",
    ],
    claimsForbidden: [
      "Any prescription medicine name, brand or molecule (Wegovy, Ozempic, Mounjaro, semaglutide, tirzepatide...)",
      "Kilos lost, timeframes or guaranteed outcomes",
      "Before/after body imagery",
      "No need to see a doctor",
    ],
    visual: {
      colors: ["#1860F0", "#90A8C0", "#D8A890", "#F0F0F0"],
      logoUrl: asset("aclinic", "logo-icon-512.png"),
      referenceImages: [
        asset("aclinic", "hero_image.jpg"),
        asset("aclinic", "happy-doctor.jpg"),
        asset("aclinic", "doctor-computer.jpg"),
        asset("aclinic", "og-image.jpg"),
      ],
      styleNotes:
        "Soft painterly illustration in greens and warm pinks, plus calm natural-light photography. Doctors are illustrations, never real faces.",
    },
    competitors: [],
    gaps: [
      "No testimonials or outcomes on site",
      "Doctor credentials not shown",
      "Prices not visible before the questionnaire",
      "Who can appear on camera (doctor consent)",
      "Paid ads status (LegitScript / Meta authorization)",
    ],
    sources: [{ url: "https://a.clinic", fetchedAt: "2026-10-11T19:00:00.000Z" }],
  },
};

export const hound: Brand = {
  id: BRAND_IDS.hound,
  slug: "hound",
  name: "Hound",
  url: "https://houndapp.xyz",
  vertical: "consumer_app",
  countries: ["ES", "GB", "US"],
  languages: ["en", "es"],
  rulePack: "consumer_app_pet",
  demo: false,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  dossier: {
    oneLiner: "A daily behavior plan built for your dog.",
    positioning:
      "A personalized 12 to 52 week plan with one short exercise a day (about 10 minutes), progress and streaks. Built on desensitization and counter-conditioning for separation anxiety, barking, destruction, pulling on the lead, reactivity and extra weight. Every CTA routes to an age-based quiz (puppy, adolescent, adult, senior).",
    offers: [
      { name: "Weekly plan", price: "$10 / week", notes: "From App Studio notes; verify on site" },
      { name: "Yearly plan", price: "$59.99 / year", notes: "From App Studio notes; verify on site" },
      { name: "Exit-intent offer", price: "$29.99", notes: "Web funnel with Paddle; verify" },
    ],
    personas: [
      {
        name: "First-time dog owner, 25 to 40, city flat",
        pains: [
          "Dog cries or barks when left alone",
          "Neighbours complain",
          "Feels like a bad owner",
          "Walks are a fight because of pulling",
        ],
        desires: ["A calm dog", "Leaving home without guilt", "A clear daily routine"],
        objections: ["Does an app really work for dogs?", "I have no time", "Trainers are expensive"],
        whereTheyAre: ["TikTok dog training content", "Instagram Reels", "r/Dogtraining", "r/puppy101", "YouTube"],
      },
      {
        name: "Rescue dog adopter",
        pains: ["Reactivity on walks", "Fear and anxiety from the dog's past"],
        desires: ["Help the dog feel safe", "Progress they can see"],
        objections: ["My dog is a special case", "Positive training is too slow"],
        whereTheyAre: ["r/reactivedogs", "Facebook rescue groups", "Instagram"],
      },
    ],
    voice: {
      tone: "Warm, friendly, encouraging, never preachy.",
      do: ["Talk about progress and practice", "Make 10 minutes a day feel doable", "Celebrate small wins"],
      dont: ["Promise cures or guarantees", "Show a dog in distress", "Blame the owner"],
    },
    proof: [
      "Personalized plan by age and problem",
      "Methods: desensitization and counter-conditioning",
      "One 10-minute exercise a day",
    ],
    claimsAllowed: [
      "Helps you practice calmer alone time",
      "10 minutes a day",
      "Plan built for your dog's age and problem",
    ],
    claimsForbidden: [
      "Cures separation anxiety",
      "Guaranteed results or timeframes",
      "Veterinary or medical advice",
      "Punishment-based training",
    ],
    visual: {
      colors: ["#C07848", "#A8C048", "#D89048", "#FFF0E0"],
      logoUrl: asset("hound", "logo-icon.png"),
      referenceImages: [
        asset("hound", "hero-reveal.webp"),
        asset("hound", "hero-not-alone.webp"),
        asset("hound", "problem-separation.webp"),
        asset("hound", "problem-pulling.webp"),
        asset("hound", "age-puppy.webp"),
      ],
      styleNotes:
        "Flat, warm, friendly vector illustration: a beagle, oranges and greens, soft clouds, rounded shapes, cream background.",
    },
    competitors: [],
    gaps: [
      "No pricing on the landing page",
      "No reviews or app store badges",
      "No social links",
      "Which problem converts best in the quiz",
      "Spain-first: Spanish creative or English?",
    ],
    sources: [{ url: "https://houndapp.xyz", fetchedAt: "2026-10-11T19:00:00.000Z" }],
  },
};

export const dynova: Brand = {
  id: BRAND_IDS.dynova,
  slug: "dynova",
  name: "Dynova",
  url: "https://dynova.health",
  vertical: "health_wellness_dtc",
  countries: ["TR"],
  languages: ["tr", "en"],
  rulePack: "tr_health_wellness",
  demo: false,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  dossier: {
    oneLiner: "Personal health decisions based on your own data.",
    positioning:
      "Three lines built on personal data: Dynova Health (at-home genetic test with reports on nutrition, healthy aging, performance, skin and drug response, with doctors and dietitians), Dynova Nutrition (personalized monthly vitamins and supplements, made in USA) and Dynova Beauty (face-photo skin analysis across 11 areas plus a routine).",
    offers: [
      { name: "Dynova Health genetic test", notes: "At-home kit, reports, doctor and dietitian support" },
      { name: "Dynova Nutrition", notes: "Personalized monthly supplements, made in USA" },
      { name: "Dynova Beauty", notes: "Face-photo skin analysis (11 areas) + routine" },
    ],
    personas: [
      {
        name: "Health-curious urban professional in Istanbul, 28 to 45",
        pains: ["Generic advice that does not fit", "Too many supplement choices"],
        desires: ["Decisions based on my own data", "A premium, simple routine"],
        objections: ["Is a genetic test worth it?", "What happens to my data?"],
        whereTheyAre: ["Instagram", "YouTube", "Health podcasts"],
      },
    ],
    voice: {
      tone: "Premium, clear, science-literate, calm.",
      do: ["Explain what the report shows", "Make data feel personal"],
      dont: ["Claim diagnosis, treatment or prevention", "Use superlatives without proof", "Show real customer data"],
    },
    proof: ["Team credentials (MDs, a visiting AI researcher at Harvard)", "Doctors and dietitians involved"],
    claimsAllowed: ["Informational reports from your own data", "A routine built on your results"],
    claimsForbidden: [
      "Diagnoses, treats, cures or prevents disease",
      "Doctor-recommended (unless provided and true)",
      "Best / most accurate without proof",
    ],
    visual: {
      colors: ["#000030", "#6048A8", "#F0F0F0", "#C0C0C0"],
      logoUrl: asset("dynova", "dynova-mark.svg"),
      referenceImages: [
        asset("dynova", "og-image.jpg"),
        asset("dynova", "lab-tubes.webp"),
        asset("dynova", "nutrition-products.webp"),
        asset("dynova", "sun-portrait.webp"),
      ],
      styleNotes: "Clean premium health photography, soft warm skies, lab and capsule close-ups.",
    },
    competitors: [],
    gaps: ["No testimonials, studies or certifications", "No customer numbers", "Tiers (Prestige) unexplained"],
    sources: [{ url: "https://dynova.health", fetchedAt: "2026-10-11T19:00:00.000Z" }],
  },
};

export const evreon: Brand = {
  id: BRAND_IDS.evreon,
  slug: "evreon",
  name: "Evreon AI",
  url: "https://evreonai.com",
  vertical: "b2b_saas",
  countries: ["HU", "GB", "DE"],
  languages: ["en"],
  rulePack: "b2b_healthtech",
  demo: false,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  dossier: {
    oneLiner: "An agentic operating system for clinics.",
    positioning:
      'Agents for reception (scheduling, booking), intake (pre-visit history in the patient\'s language), records (reads and files scanned or foreign-language documents with source links) and billing; a scribe is coming. Less paperwork, every output traceable to its source, and it never makes diagnoses ("0 diagnoses made. By design."). Offices in Budapest and London, live in the EU.',
    offers: [{ name: "Demo", notes: "Book a 20-minute demo" }],
    personas: [
      {
        name: "Private practice owner or practice manager",
        pains: ["Phone and booking chaos", "Paperwork after hours", "Foreign-language patient documents"],
        desires: ["Less admin", "Traceable outputs", "EU data residency"],
        objections: ["Is AI safe in a clinic?", "Will it integrate with our system?", "GDPR"],
        whereTheyAre: ["LinkedIn", "Practice-manager communities", "Medical conferences"],
      },
      {
        name: "Multi-doctor clinic operations lead",
        pains: ["Intake bottlenecks", "Staff turnover at reception"],
        desires: ["Consistent intake in every language", "Fewer no-shows"],
        objections: ["Change management", "Cost"],
        whereTheyAre: ["LinkedIn", "Healthcare ops newsletters"],
      },
    ],
    voice: {
      tone: "Restrained, clinical-premium, precise.",
      do: ["Show traceability", "Talk about time saved on admin", "Say clearly that it does not diagnose"],
      dont: ["Claim diagnostic accuracy", "Use customer logos without permission", "Overpromise automation"],
    },
    proof: ["Peer-reviewed paper", "Physician advisers", "EU data residency", "50+ languages"],
    claimsAllowed: [
      "Every output links to its source",
      "Works in 50+ languages",
      "EU data residency",
      "Never diagnoses",
    ],
    claimsForbidden: ["Diagnostic capability or accuracy numbers", "Customer logos, names or quotes not provided"],
    visual: {
      colors: ["#781818", "#181818", "#F0F0F0", "#D8D8D8"],
      logoUrl: asset("evreon", "evreon-mark.svg"),
      referenceImages: [asset("evreon", "contact-bg.jpg"), asset("evreon", "evreon-mark-1024.png")],
      styleNotes: "Restrained, clinical-premium, oxblood mark on off-white, lots of space.",
    },
    competitors: [],
    gaps: ["No pricing", "No customer logos or case studies", "Which buyer segment converts first"],
    sources: [{ url: "https://evreonai.com", fetchedAt: "2026-10-11T19:00:00.000Z" }],
  },
};

export const SEED_BRANDS: Brand[] = [hound, aclinic, dynova, evreon];
