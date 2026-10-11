import type { Phase } from "@/contracts";
import type { PhaseRunner } from "../pipeline";
import { intake } from "./intake";

/** Phase implementations. A phase without a runner is passed through (logged as completed). */
export const PHASE_RUNNERS: Partial<Record<Phase, PhaseRunner>> = {
  intake,
};
