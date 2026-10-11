"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UrlInput } from "@/components/ui/UrlInput";

export function Hero() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const start = (url: string) => {
    setLeaving(true);
    router.push(`/brands/new?url=${encodeURIComponent(url)}`);
  };
  return (
    <section className="mx-auto grid max-w-[1440px] gap-10 px-4 pt-28 pb-14 md:grid-cols-12 md:px-8 md:pt-36">
      <div className="md:col-span-9">
        <p className="mono-label">Go-to-market for operators who run many brands</p>
        <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.035em]">
          We take apart the ads that are winning. Then we rebuild them for your brand.
        </h1>
      </div>
      <div className="flex flex-col justify-end gap-5 md:col-span-7">
        <p className="max-w-[620px] text-body text-bone-2 md:text-[17px]">
          Paste a site. Nexus reads it, finds what already works in your niche, asks only what the data could not
          answer, picks the channels and makes the posts. Nothing goes out without you.
        </p>
        <div className="max-w-[560px]">
          <UrlInput onSubmit={start} loading={leaving} placeholder="houndapp.xyz" cta="Start" />
        </div>
        <p className="text-[13px] text-bone-2">
          Or open the{" "}
          <Link
            href="/brands"
            className="text-bone underline decoration-bone-4 underline-offset-4 hover:decoration-bone"
          >
            portfolio of four live brands
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
