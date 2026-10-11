import type { Phase } from "@/contracts";
import type { PhaseRunner } from "../pipeline";
import { consult } from "./consult";
import { direction } from "./direction";
import { intake } from "./intake";
import { research } from "./research";
import { reverseEngineer } from "./reverse";

/** Phase implementations. A phase without a runner is passed through (logged as completed). */
export const PHASE_RUNNERS: Partial<Record<Phase, PhaseRunner>> = {
  intake,
  research,
  reverse_engineer: reverseEngineer,
  consult,
  direction,
};
