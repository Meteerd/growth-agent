"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/client/cn";

/** A muted loop of our own render: poster first, plays only while on screen, never under reduced motion. */
export function LoopVideo({
  src,
  poster,
  label,
  eager,
  className,
}: {
  src: string;
  poster?: string;
  label: string;
  /** above the fold: fetch metadata at once; below it nothing loads until it is near */
  eager?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), {
      rootMargin: "200px",
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload={eager ? "metadata" : "none"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
