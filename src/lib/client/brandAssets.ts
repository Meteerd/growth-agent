import type { Brand } from "@/contracts";

// v2 is on paper, so every brand uses its standard mark (the v1 light variants vanished on white).
export const logoOnDark = (b: Pick<Brand, "slug" | "dossier">) => b.dossier.visual.logoUrl;

/** Brand-owned reference images, used as visual stand-ins where the engine has not generated a frame yet. */
export const referenceImages = (b?: Pick<Brand, "dossier">) => b?.dossier.visual.referenceImages ?? [];
