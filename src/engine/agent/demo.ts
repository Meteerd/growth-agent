import { DEMO_RUNS, type DemoRunBundle } from "@/contracts";

/**
 * Demo data for a new run of a seeded brand: the brand's demo bundle with every entity id re-scoped to the new
 * run, so the same code paths can write it without clashing with the seeded demo run.
 */
export function demoBundleFor(slug: string, runId: string): DemoRunBundle | null {
  const src = DEMO_RUNS[slug];
  if (!src) return null;
  const sfx = runId.slice(-6);
  const json = JSON.stringify(src)
    .replaceAll(src.run.id, runId)
    .replace(new RegExp(`(ev|q|plan|concept|cc|pack|bp|review)_${slug}_`, "g"), `$1_${slug}${sfx}_`);
  return JSON.parse(json) as DemoRunBundle;
}
