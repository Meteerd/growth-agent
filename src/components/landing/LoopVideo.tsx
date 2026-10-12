"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/client/cn";

/** A muted loop of our own render: the poster is a real image painted at once (fast first paint, never blank); the
 * video fades in over it once it actually plays, only while on screen, and never under reduced motion. */
export function LoopVideo({
  src,
  poster,
  label,
  eager,
  sound,
  className,
}: {
  src: string;
  poster?: string;
  label: string;
  /** above the fold: fetch metadata at once; below it nothing loads until it is near */
  eager?: boolean;
  /** play with sound (only after a click, which browsers require) */
  sound?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = !sound;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), {
      rootMargin: "200px",
    });
    // let the page (posters, fonts) finish first; the videos are the decoration, not the content
    const start = () => io.observe(v);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      io.disconnect();
    };
  }, [sound]);
  return (
    <div className={cn("relative h-full w-full", className)}>
      {poster && (
        // biome-ignore lint/performance/noImgElement: a plain poster frame, sized by its tile
        <img
          src={poster}
          alt=""
          loading={eager ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <video
        ref={ref}
        src={src}
        aria-label={label || undefined}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          playing ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

/** Our remake with its dubbed versions: a language toggle that also turns the sound on. */
export function DubbedLoop({
  src,
  poster,
  label,
  original,
  dubs,
}: {
  src: string;
  poster?: string;
  label: string;
  original: string;
  dubs: { lang: string; src: string }[];
}) {
  const [lang, setLang] = useState(original);
  const [sound, setSound] = useState(false);
  const cur = dubs.find((d) => d.lang === lang)?.src ?? src;
  return (
    <div className="relative h-full w-full">
      <LoopVideo key={cur} src={cur} poster={poster} label={`${label}, ${lang}`} sound={sound} />
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1">
        {[...new Set([original, ...dubs.map((d) => d.lang)])].map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={l === lang}
            onClick={() => {
              setLang(l);
              setSound(true);
            }}
            className={cn(
              "h-7 rounded-full px-2.5 font-semibold text-[12px] uppercase transition-colors duration-150",
              l === lang ? "bg-white text-[#111]" : "bg-black/45 text-white hover:bg-black/70",
            )}
          >
            {l}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSound((x) => !x)}
          className="ml-auto h-7 rounded-full bg-black/45 px-2.5 text-[12px] text-white hover:bg-black/70"
        >
          {sound ? "Sound off" : "Sound on"}
        </button>
      </div>
    </div>
  );
}
