import type { Brand } from "@/contracts";

// Light variants of the brand marks for the dark cockpit (files in assets/brands, served by /api/assets).
const ON_DARK: Record<string, string> = {
  dynova: "/api/assets/brands/dynova/dynova-mark-white.svg",
  evreon: "/api/assets/brands/evreon/evreon-mark-light.svg",
};

export const logoOnDark = (b: Pick<Brand, "slug" | "dossier">) => ON_DARK[b.slug] ?? b.dossier.visual.logoUrl;

/** Brand-owned reference images, used as visual stand-ins where the engine has not generated a frame yet. */
export const referenceImages = (b?: Pick<Brand, "dossier">) => b?.dossier.visual.referenceImages ?? [];
