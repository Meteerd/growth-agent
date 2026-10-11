import type { ShotPurpose } from "@/contracts";

/** Beat tape colours: flat, print-like, like coloured tape on an edit (docs/DESIGN.md v2). */
export const PURPOSE_COLOR: Record<ShotPurpose, string> = {
  hook: "#C9962E", // ochre
  problem: "#A6402B", // brick
  agitate: "#C46A2A", // rust
  solution: "#2E7D7A", // teal
  demo: "#5B6B7A", // slate
  proof: "#6F7A35", // olive
  offer: "#7A4E6E", // plum
  cta: "#222222", // ink
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
