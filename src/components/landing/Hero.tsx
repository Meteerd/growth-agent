"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UrlInput } from "@/components/ui/UrlInput";
import { cn } from "@/lib/client/cn";
import { useField, useFieldActivity } from "@/lib/client/field";

const LINES = ["Where your brand", "should show up,", "and the content", "that wins there."];

export function Hero() {
  useFieldActivity(0.15);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const start = (url: string) => {
    setLeaving(true);
    // vortex: the field swirls into the input, content falls away, then the route changes
    useField.getState().set({ vortex: 1, activity: 1 });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => router.push(`/brands/new?url=${encodeURIComponent(url)}`), reduce ? 0 : 650);
  };

  return (
    <section
      className={cn(
        "relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-center px-4 pt-24 pb-16 transition-[opacity,transform,filter] duration-700 ease-out md:px-8",
        leaving && "scale-[0.96] opacity-0 blur-[2px]",
      )}
    >
      <div className="mx-auto w-full max-w-[980px] text-center">
        <p className="rise mono-label" style={{ animationDelay: "120ms" }}>
          A go-to-market agent for operators who run many brands
        </p>
        <h1 className="mt-6 font-serif text-[clamp(2.6rem,9vw,6.5rem)] leading-[0.98] tracking-[-0.014em]">
          {LINES.map((l, i) => (
            <span key={l} className="mask-line">
              <span className="text-gradient-bone" style={{ animationDelay: `${200 + i * 90}ms` }}>
                {i === 1 ? (
                  <>
                    should <em className="italic">show up,</em>
                  </>
                ) : (
                  l
                )}
              </span>
            </span>
          ))}
        </h1>
        <p
          className="rise mx-auto mt-8 max-w-[600px] text-bone-2 text-body md:text-[17px]"
          style={{ animationDelay: "620ms" }}
        >
          Paste a site. The agent reads it, studies the ads and posts already winning in your niche, asks only what the
          data could not answer, picks the channels, and remakes what wins for your brand. Nothing goes out without you.
        </p>
        <div className="rise mx-auto mt-10 max-w-[560px]" style={{ animationDelay: "760ms" }}>
          <UrlInput onSubmit={start} loading={leaving} placeholder="houndapp.xyz" cta="Start" />
        </div>
        <p className="rise mt-2 font-mono text-[11px] text-bone-3" style={{ animationDelay: "880ms" }}>
          or open the{" "}
          <Link href="/brands" className="text-bone-2 underline decoration-bone-4 underline-offset-4 hover:text-bone">
            portfolio of four live brands
          </Link>
        </p>
      </div>
    </section>
  );
}
