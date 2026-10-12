/**
 * The 2-minute pitch, in order. Presentation mode maps keys 1 to 8 onto it and auto-plays it; the offline proof and the
 * backup recording walk it. The Hound showcase runs are seeded on every machine, so these ids are stable.
 */
export const HOUND_RUN = "run_mv4e0ud7671d68be0a"; // full live run, flagship remake
export const HOUND_RESEARCH = "run_mv4c9xtr8203508c41"; // recorded research pass, Manus deep research
export const HOUND_BLUEPRINT = "bp_mv4cfk3o0860575961_68be0a"; // the winner our flagship remakes

export type DemoStep = { key: string; label: string; href: string; secs: number };

export const DEMO_PATH: DemoStep[] = [
  { key: "1", label: "Portfolio", href: "/brands", secs: 12 },
  { key: "2", label: "Research", href: `/runs/${HOUND_RESEARCH}`, secs: 14 },
  { key: "3", label: "Reverse-engineer", href: `/runs/${HOUND_RUN}/blueprints/${HOUND_BLUEPRINT}`, secs: 26 },
  { key: "4", label: "Consultation", href: `/runs/${HOUND_RUN}/consult`, secs: 14 },
  { key: "5", label: "Direction", href: `/runs/${HOUND_RUN}/direction`, secs: 14 },
  { key: "6", label: "Studio", href: `/runs/${HOUND_RUN}/studio`, secs: 16 },
  { key: "7", label: "Packs", href: `/runs/${HOUND_RUN}/packs`, secs: 14 },
  { key: "8", label: "Results", href: "/brands/hound/results", secs: 10 },
];
