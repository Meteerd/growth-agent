"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/client/cn";

/** 9:16 phone frame with a custom player. Missing or broken video shows a designed empty state, never a broken icon. */
export function PhoneFrame({
  src,
  poster,
  empty = "No render yet",
  overlay,
  className,
  children,
}: {
  src?: string;
  poster?: string;
  empty?: string;
  overlay?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [broken, setBroken] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the player whenever the source changes
  useEffect(() => {
    setBroken(false);
    setT(0);
    setPlaying(false);
  }, [src]);
  const showVideo = src && !broken;
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setBroken(true));
    else v.pause();
  };
  return (
    <div className={cn("relative mx-auto aspect-[9/19.5] w-full max-w-[300px]", className)}>
      <div className="absolute inset-0 rounded-[44px] bg-[linear-gradient(160deg,#2a2d35,#0b0c10_40%,#1a1c22)] p-[3px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8),inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <div className="relative h-full w-full overflow-hidden rounded-[41px] bg-ink">
          <div
            aria-hidden
            className="absolute top-2.5 left-1/2 z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black"
          />
          {showVideo ? (
            <>
              <video
                ref={ref}
                src={src}
                poster={poster}
                playsInline
                preload="auto"
                loop
                muted
                className="absolute inset-0 h-full w-full object-cover"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
                onError={() => setBroken(true)}
              />
              <button
                onClick={toggle}
                className="absolute inset-0 z-10 grid place-items-center"
                aria-label={playing ? "Pause" : "Play"}
              >
                <span
                  className={cn(
                    "grid size-14 place-items-center rounded-full bg-[rgb(6_7_10/0.5)] text-bone backdrop-blur-md transition-opacity duration-300",
                    playing && "opacity-0",
                  )}
                >
                  <svg viewBox="0 0 16 16" className="ml-0.5 size-5" aria-hidden>
                    <path d="M4 2.5v11l9-5.5-9-5.5Z" fill="currentColor" />
                  </svg>
                </span>
              </button>
              <div className="absolute inset-x-5 bottom-4 z-10 h-0.5 overflow-hidden rounded-full bg-[rgb(236_231_221/0.2)]">
                <div className="h-full bg-bone" style={{ width: `${t * 100}%` }} />
              </div>
            </>
          ) : (
            (children ?? (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                <div className="skeleton absolute inset-0 rounded-none opacity-40" />
                <div className="relative">
                  <p className="font-serif text-[22px] italic">{empty}</p>
                  {broken && (
                    <p className="mt-2 font-mono text-[11px] text-bone-3">
                      The video file is not available on this machine.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          {overlay}
        </div>
      </div>
    </div>
  );
}
