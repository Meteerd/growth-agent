/**
 * The 2-minute pitch, in order. Presentation mode maps keys 1 to 9 onto it and auto-plays it; the offline proof and the
 * backup recording walk it. The Hound showcase runs are seeded on every machine, so these ids are stable.
 */
export const HOUND_RUN = "run_mv4e0ud7671d68be0a"; // full live run on recorded research: Manus findings, flagship remake
export const HOUND_BLUEPRINT = "bp_mv4cfk3o0860575961_68be0a"; // the winner our flagship remakes

/** `scroll`: during auto-play, at each [fraction of the step's time] scroll down by [fraction of the viewport]. */
export type DemoStep = { key: string; label: string; href: string; secs: number; scroll?: [number, number][] };

// Mete's pitch (12 Oct 10:53): how it works (the landing), then the results, then the app screens behind them
const down = (n: number, from: number, to: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [from + ((to - from) * i) / Math.max(1, n - 1), 0.85]);

export const DEMO_PATH: DemoStep[] = [
  { key: "1", label: "How it works", href: "/", secs: 34, scroll: down(9, 0.1, 0.86) },
  { key: "2", label: "Results", href: "/results", secs: 30, scroll: down(6, 0.12, 0.85) },
  { key: "3", label: "Portfolio", href: "/brands", secs: 8 },
  { key: "4", label: "The run", href: `/runs/${HOUND_RUN}`, secs: 8 },
  { key: "5", label: "Reverse-engineer", href: `/runs/${HOUND_RUN}/blueprints/${HOUND_BLUEPRINT}`, secs: 14 },
  { key: "6", label: "Consultation", href: `/runs/${HOUND_RUN}/consult`, secs: 6 },
  { key: "7", label: "Direction", href: `/runs/${HOUND_RUN}/direction`, secs: 8, scroll: [[0.5, 0.5]] },
  { key: "8", label: "Studio", href: `/runs/${HOUND_RUN}/studio`, secs: 6 },
  { key: "9", label: "Packs", href: `/runs/${HOUND_RUN}/packs`, secs: 6, scroll: [[0.4, 0.55]] },
];
