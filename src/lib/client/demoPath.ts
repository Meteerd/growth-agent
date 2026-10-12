/**
 * The 2-minute pitch, in order. Presentation mode maps keys 1 to 8 onto it and auto-plays it; the offline proof and the
 * backup recording walk it. The Hound showcase runs are seeded on every machine, so these ids are stable.
 */
export const HOUND_RUN = "run_mv4e0ud7671d68be0a"; // full live run on recorded research: Manus findings, flagship remake
export const HOUND_BLUEPRINT = "bp_mv4cfk3o0860575961_68be0a"; // the winner our flagship remakes

/** `scroll`: during auto-play, at each [fraction of the step's time] scroll down by [fraction of the viewport]. */
export type DemoStep = { key: string; label: string; href: string; secs: number; scroll?: [number, number][] };

export const DEMO_PATH: DemoStep[] = [
  { key: "1", label: "Portfolio", href: "/brands", secs: 12, scroll: [[0.55, 0.45]] },
  { key: "2", label: "The run", href: `/runs/${HOUND_RUN}`, secs: 14, scroll: [[0.6, 0.55]] },
  {
    key: "3",
    label: "Reverse-engineer",
    href: `/runs/${HOUND_RUN}/blueprints/${HOUND_BLUEPRINT}`,
    secs: 26,
    scroll: [[0.6, 0.5]],
  },
  { key: "4", label: "Consultation", href: `/runs/${HOUND_RUN}/consult`, secs: 14, scroll: [[0.55, 0.5]] },
  { key: "5", label: "Direction", href: `/runs/${HOUND_RUN}/direction`, secs: 14, scroll: [[0.55, 0.5]] },
  { key: "6", label: "Studio", href: `/runs/${HOUND_RUN}/studio`, secs: 16, scroll: [[0.55, 0.5]] },
  {
    key: "7",
    label: "Packs",
    href: `/runs/${HOUND_RUN}/packs`,
    secs: 14,
    scroll: [
      [0.3, 0.55],
      [0.65, 0.5],
    ],
  },
  { key: "8", label: "Results", href: "/brands/hound/results", secs: 10 },
];
