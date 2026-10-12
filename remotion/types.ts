export interface AdShot {
  /** image URL (keyframe) */
  src: string;
  /** optional video clip URL (image-to-video); falls back to Ken Burns on the image */
  clipSrc?: string;
  durationSec: number;
  text?: string;
  /** where the caption sits (A18): "upper" third by default, moved when it would cover the subject */
  captionRegion?: "upper" | "middle" | "lower";
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
  /** still camera moves: "final" oversamples 8x (no pixel-rounding shake, heavy), "draft" 2x (fast, may shimmer) */
  motionQuality?: "draft" | "final";
  [key: string]: unknown;
}

export const FPS = 30;

export function totalFrames(p: Pick<Ad916Props, "shots" | "endCardSec">): number {
  return Math.max(1, Math.round((p.shots.reduce((a, s) => a + s.durationSec, 0) + p.endCardSec) * FPS));
}
