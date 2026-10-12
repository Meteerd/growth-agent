"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandSummary } from "@/contracts";
import { cn } from "@/lib/client/cn";

const LANG: Record<string, string> = { en: "English", sk: "Slovak", cs: "Czech", tr: "Turkish", es: "Spanish" };
export const langName = (code: string) => LANG[code] ?? code.toUpperCase();

/** The brand's cast ElevenLabs voice, with its sample when the engine has one on this machine. */
export function VoiceLine({ voice, className }: { voice: NonNullable<BrandSummary["voice"]>; className?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);
  const [name, flavour] = voice.name.split(" - ");
  return (
    <div className={cn("flex items-center gap-3", className)} data-testid="brand-voice">
      {voice.sampleUrl && (
        <button
          type="button"
          aria-label={playing ? `Stop the ${name} sample` : `Play the ${name} sample`}
          onClick={() => {
            audio.current ??= Object.assign(new Audio(voice.sampleUrl), { onended: () => setPlaying(false) });
            if (playing) audio.current.pause();
            else audio.current.play().catch(() => setPlaying(false));
            setPlaying(!playing);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-bone text-ink transition-colors duration-150 hover:bg-signal"
        >
          {playing ? (
            <span className="flex gap-[3px]" aria-hidden>
              <span className="h-2.5 w-[3px] bg-current" />
              <span className="h-2.5 w-[3px] bg-current" />
            </span>
          ) : (
            <svg viewBox="0 0 16 16" className="ml-0.5 size-3" aria-hidden>
              <path d="M4 2.5v11l9-5.5-9-5.5Z" fill="currentColor" />
            </svg>
          )}
        </button>
      )}
      <p className="min-w-0 text-[13px] leading-snug">
        <span className="text-bone-3">Voice </span>
        <span className="font-medium text-bone">{name}</span>
        {flavour && <span className="text-bone-2">, {flavour.toLowerCase()}</span>}
        <span className="text-bone-3"> / {langName(voice.language)} / ElevenLabs</span>
        {voice.persona && <span className="block truncate text-[12px] text-bone-3">{voice.persona}</span>}
      </p>
    </div>
  );
}
