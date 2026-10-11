import type { DemoRunBundle } from "./builder";
import { aclinicDemo } from "./runs/aclinic";
import { dynovaDemo } from "./runs/dynova";
import { evreonDemo } from "./runs/evreon";
import { houndDemo } from "./runs/hound";

export { aclinic, BRAND_IDS, dynova, evreon, hound, SEED_BRANDS } from "./brands";
export type { DemoRunBundle } from "./builder";
export { DEFAULT_WEIGHTS, DEMO_CAPTURED_AT, weightedScore } from "./builder";
export { aclinicDemo, dynovaDemo, evreonDemo, houndDemo };

/** One complete demo run per brand, keyed by brand slug. */
export const DEMO_RUNS: Record<string, DemoRunBundle> = {
  hound: houndDemo,
  aclinic: aclinicDemo,
  dynova: dynovaDemo,
  evreon: evreonDemo,
};
