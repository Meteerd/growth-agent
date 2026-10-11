import type { Phase } from "@/contracts";
import type { PhaseRunner } from "../pipeline";
import { consult } from "./consult";
import { direction } from "./direction";
import { complianceGate } from "./gate";
import { intake } from "./intake";
import { pack } from "./pack";
import { production } from "./production";
import { research } from "./research";
import { reverseEngineer } from "./reverse";
import { review } from "./review";

/** Phase implementations. A phase without a runner is passed through (logged as completed). */
export const PHASE_RUNNERS: Partial<Record<Phase, PhaseRunner>> = {
  intake,
  research,
  reverse_engineer: reverseEngineer,
  consult,
  direction,
  production,
  review,
  compliance: complianceGate,
  pack,
};
