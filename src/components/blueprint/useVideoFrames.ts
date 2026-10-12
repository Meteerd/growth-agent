"use client";

import { useEffect, useState } from "react";

/**
 * Thumbnails taken from our own render at the given times (seconds), so the V2 lane shows the real cut even when
 * the per-shot keyframes are not on this machine. Same-origin video only (engine assets), drawn offscreen.
 */
export function useVideoFrames(src: string | undefined, times: number[]) {
  const [frames, setFrames] = useState<Map<number, string>>(new Map());
  const key = times.map((t) => t.toFixed(2)).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: times are compared through `key`
  useEffect(() => {
    if (!src || !times.length) return;
    let stop = false;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = src;
    const canvas = document.createElement("canvas");
    const out = new Map<number, string>();
    let i = 0;
    const next = () => {
      if (stop || i >= times.length) return;
      v.currentTime = Math.min(times[i], Math.max(0, (v.duration || times[i]) - 0.05));
    };
    const onSeeked = () => {
      if (stop) return;
      const w = 180;
      const h = Math.round((w * (v.videoHeight || 16)) / (v.videoWidth || 9));
      canvas.width = w;
      canvas.height = h;
      try {
        canvas.getContext("2d")?.drawImage(v, 0, 0, w, h);
        out.set(times[i], canvas.toDataURL("image/jpeg", 0.72));
        setFrames(new Map(out));
      } catch {
        return; // a cross-origin or broken video: keep the other fallbacks
      }
      i++;
      next();
    };
    v.addEventListener("loadedmetadata", next, { once: true });
    v.addEventListener("seeked", onSeeked);
    return () => {
      stop = true;
      v.removeEventListener("seeked", onSeeked);
      v.removeAttribute("src");
      v.load();
    };
  }, [src, key]);
  return frames;
}
