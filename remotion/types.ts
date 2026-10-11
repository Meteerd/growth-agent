export interface AdShot {
  /** image URL (keyframe) */
  src: string;
  /** optional video clip URL (image-to-video); falls back to Ken Burns on the image */
  clipSrc?: string;
  durationSec: number;
  text?: string;
}

export interface Ad916Props {
  shots: AdShot[];
  voiceoverSrc?: string;
  brandName: string;
  colors: string[];
  logoSrc?: string;
  cta: string;
  /** label burned in the corner, e.g. "Demo render" */
  badge?: string;
  endCardSec: number;
  [key: string]: unknown;
}

export const FPS = 30;

export function totalFrames(p: Pick<Ad916Props, "shots" | "endCardSec">): number {
  return Math.max(1, Math.round((p.shots.reduce((a, s) => a + s.durationSec, 0) + p.endCardSec) * FPS));
}
