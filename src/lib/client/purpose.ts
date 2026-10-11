import type { ShotPurpose } from "@/contracts";

/** One colour per narrative purpose, shared by the landing strip and the reverse-engineer timeline. */
export const PURPOSE_COLOR: Record<ShotPurpose, string> = {
  hook: "#D4FF3A",
  problem: "#FF5C7A",
  agitate: "#FFC85C",
  solution: "#3CE0FF",
  demo: "#9FD8FF",
  proof: "#7CFFB2",
  offer: "#8C6BFF",
  cta: "#ECE7DD",
};

export const PURPOSE_LABEL: Record<ShotPurpose, string> = {
  hook: "Hook",
  problem: "Problem",
  agitate: "Agitate",
  solution: "Solution",
  demo: "Demo",
  proof: "Proof",
  offer: "Offer",
  cta: "CTA",
};
