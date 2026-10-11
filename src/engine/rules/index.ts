/**
 * Rule packs from docs/BRANDS.md (drafted 11 Oct 2026; guardrails, not legal advice).
 * `patterns` are a deterministic first pass (case-insensitive); Claude then judges the whole piece against the
 * rule text. A pattern hit on a `block` rule always fails, whatever the model says.
 */
export interface Rule {
  id: string;
  severity: "block" | "warn";
  text: string;
  source?: string;
  verify?: boolean;
  patterns?: RegExp[];
  /** applies only to paid placements */
  paidOnly?: boolean;
}

export interface RulePack {
  id: string;
  label: string;
  rules: Rule[];
  platformNotes: string[];
}

const COMMON: Rule[] = [
  {
    id: "C1",
    severity: "block",
    text: "No fabricated statistics, testimonials, reviews, user counts or results.",
    patterns: [
      /\b\d{2,3}(,\d{3})*\+?\s+(happy\s+)?(customers|users|patients|owners)\b/i,
      /\b(9\d|100)\s?% (of )?(users|customers|patients|owners)\b/i,
    ],
  },
  {
    id: "C2",
    severity: "block",
    text: "No copying another brand's creative, script, music or footage; remakes must be original.",
  },
  {
    id: "C3",
    severity: "block",
    text: "No fake scarcity or fake urgency unless true and provided by the operator.",
    patterns: [/only \d+ (spots|places|left)/i, /\b(last chance|ends tonight|hurry)\b/i],
  },
  {
    id: "C4",
    severity: "warn",
    text: "AI-generated people must not be presented as real customers or real doctors; label as dramatization where required.",
  },
  {
    id: "C5",
    severity: "warn",
    text: "Platform disclosure rules for AI-generated content (TikTok and Meta AI labels) must be followed at posting time (pack checklist).",
  },
];

const RX_DRUGS =
  /\b(wegovy|ozempic|mounjaro|zepbound|saxenda|rybelsus|semaglutid\w*|tirzepatid\w*|liraglutid\w*|glp-?1\s+(injection|shot|pen|drug|medication)s?)\b/i;

export const RULE_PACKS: Record<string, RulePack> = {
  common: { id: "common", label: "Common", rules: COMMON, platformNotes: [] },
  eu_rx_telehealth: {
    id: "eu_rx_telehealth",
    label: "EU prescription telehealth (SK, CZ)",
    rules: [
      ...COMMON,
      {
        id: "RX1",
        severity: "block",
        text: "Never name or show prescription-only medicines or their brands/molecules in consumer-facing content (Wegovy, Ozempic, Mounjaro, Zepbound, Saxenda, semaglutide, tirzepatide, liraglutide, 'GLP-1 injections' as a product).",
        source: "SK total ban on advertising Rx medicines; CZ SÚKL",
        patterns: [RX_DRUGS],
      },
      {
        id: "RX2",
        severity: "block",
        text: "Never imply a consultation with a doctor or a medical examination is unnecessary, or promise a diagnosis or treatment remotely as a sales hook.",
        source: "CZ advertising rules",
        patterns: [
          /\b(no (need|doctor) (for|to see) a doctor|skip the doctor|without (seeing )?a doctor|no consultation needed|guaranteed prescription|prescription guaranteed)\b/i,
        ],
      },
      {
        id: "RX3",
        severity: "block",
        text: "No promised outcomes (kg lost, timeframes), no before/after imagery, no body-shaming or negative self-image framing.",
        source: "Meta personal health policy; LegitScript",
        patterns: [
          /\b(lose|lost|drop|shed)\s+\d+\s?(kg|kilo|kilos|lbs|pounds)\b/i,
          /\b\d+\s?(kg|kilos?|lbs)\s+(in|within)\s+\d+/i,
          /before\s*(and|&|\/)\s*after/i,
        ],
      },
      {
        id: "RX4",
        severity: "block",
        paidOnly: true,
        text: "Meta/Instagram paid ads for prescription telehealth require LegitScript certification + Meta authorization; 18+ only, eligible countries only. Until certified, meta_ads is notNow.",
        source: "Meta Drugs and Pharmaceuticals ad standard",
      },
      {
        id: "RX5",
        severity: "warn",
        text: "Allowed angles: doctor-led care, convenience (no clinic visit, local pharmacy), transparency (full price before paying), support and follow-up, education about weight as a health topic without products.",
      },
      {
        id: "RX6",
        severity: "warn",
        verify: true,
        text: "Show real doctors only with their written consent; otherwise no doctor faces or a clearly fictional dramatization label.",
      },
    ],
    platformNotes: [
      "Meta: personal health and appearance policy; health-related targeting limits; prescription drugs need authorization.",
      "TikTok: medical misinformation and weight-management ad restrictions (paid); organic judged against community guidelines (verify).",
    ],
  },
  consumer_app_pet: {
    id: "consumer_app_pet",
    label: "Consumer pet app",
    rules: [
      ...COMMON,
      {
        id: "P1",
        severity: "block",
        text: "No veterinary or medical claims; behavior outcomes framed as help, practice, progress, never guarantees.",
        patterns: [
          /\b(cure[sd]?|fix(es|ed)? for good|guarantee[sd]?|permanently (fix|solve)|in \d+ days?,? guaranteed)\b/i,
          /\bcure\b.*\banxiety\b/i,
        ],
      },
      {
        id: "P2",
        severity: "block",
        text: "No depiction of animal distress, harm or punishment-based training.",
        patterns: [/\b(shock collar|prong collar|e-collar|punish(ment)?|hit (the|your) dog|alpha roll)\b/i],
      },
      {
        id: "P3",
        severity: "warn",
        text: "Severe separation anxiety: suggest a vet or qualified behaviorist (mirrors site disclaimer).",
      },
      { id: "P4", severity: "warn", text: "Subscription terms and trial conditions must be accurate if mentioned." },
    ],
    platformNotes: ["Reddit: read each subreddit's rules; value-first; disclose affiliation; never astroturf."],
  },
  tr_health_wellness: {
    id: "tr_health_wellness",
    label: "Turkish health and wellness DTC",
    rules: [
      ...COMMON,
      {
        id: "T1",
        severity: "block",
        text: "No diagnosis, treatment, cure or disease-prevention claims for genetic reports, supplements or skin analysis. Reports are informational.",
        patterns: [
          /\b(te[sş]hi[sş]|tedavi eder|iyile[sş]tirir|diagnos(e|is)|cures?|prevents? (cancer|disease|diabetes))\b/i,
        ],
      },
      {
        id: "T2",
        severity: "block",
        verify: true,
        text: "Supplements: no claims that they treat, cure or prevent disease; no 'doctor-recommended' unless provided and true.",
        patterns: [/\b(doctor[- ]recommended|doktor önerisi|hastal[ıi]ktan korur)\b/i],
      },
      {
        id: "T3",
        severity: "block",
        text: "Health and genetic data references must respect KVKK (no showing real customer data).",
      },
      {
        id: "T4",
        severity: "warn",
        text: "Comparative or superlative claims ('best', 'most accurate') need proof.",
        patterns: [/\b(the best|most accurate|number one|#1|en iyi|en doğru)\b/i],
      },
      {
        id: "T5",
        severity: "warn",
        verify: true,
        text: "Turkish health-provider advertising restrictions may apply to the doctor/dietitian consultation element.",
      },
    ],
    platformNotes: [],
  },
  b2b_healthtech: {
    id: "b2b_healthtech",
    label: "B2B healthtech (EU)",
    rules: [
      ...COMMON,
      {
        id: "E1",
        severity: "block",
        text: "Never claim diagnostic capability or clinical accuracy numbers that are not published.",
        patterns: [/\b(diagnoses|diagnostic accuracy|\d{2}(\.\d)?\s?% accura(te|cy))\b/i],
      },
      { id: "E2", severity: "block", text: "No customer logos, names or quotes unless provided by the operator." },
      { id: "E3", severity: "warn", text: "GDPR / EU data residency claims must match the site wording." },
    ],
    platformNotes: [],
  },
};

export function getRulePack(id: string): RulePack {
  return RULE_PACKS[id] ?? RULE_PACKS.common;
}

/** Rule pack as prompt text (stable, cacheable). */
export function rulePackText(id: string): string {
  const p = getRulePack(id);
  const lines = p.rules.map(
    (r) => `- ${r.id} [${r.severity}${r.paidOnly ? ", paid only" : ""}${r.verify ? ", verify" : ""}] ${r.text}`,
  );
  return [
    `Rule pack: ${p.label} (${p.id})`,
    ...lines,
    ...(p.platformNotes.length ? ["Platform notes:", ...p.platformNotes.map((n) => `- ${n}`)] : []),
  ].join("\n");
}

export interface PatternHit {
  ruleId: string;
  severity: "block" | "warn";
  excerpt: string;
  message: string;
}

/** Deterministic first pass over text. */
export function patternHits(packId: string, text: string, opts: { paid?: boolean } = {}): PatternHit[] {
  const hits: PatternHit[] = [];
  for (const r of getRulePack(packId).rules) {
    if (r.paidOnly && !opts.paid) continue;
    for (const re of r.patterns ?? []) {
      const m = text.match(re);
      if (m) {
        hits.push({ ruleId: r.id, severity: r.severity, excerpt: m[0], message: r.text });
        break;
      }
    }
  }
  return hits;
}
