import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/shell/Header";
import { cn } from "@/lib/client/cn";
import { PRODUCT_NAME } from "@/lib/client/product";
import { BlurText } from "./bits/BlurText";
import { CountUp } from "./bits/CountUp";
import { Magnet } from "./bits/Magnet";
import { brands, clips, compliance, proof, stats } from "./data";
import { DubbedLoop, LoopVideo } from "./LoopVideo";
import { UrlBar } from "./UrlBar";
import { WinnerCard } from "./Winner";

// The public website (B20). Uplane-style rhythm: a full-bleed hero graded in one colour with a contrast streak, then
// a white editorial grid with hairline columns. Every number and every video is ours and read from the recorded data.

const STEPS: [string, string][] = [
  [
    "Watch the winners",
    "Ads and posts that outperform their account, from TikTok, Instagram, Reddit, YouTube and the Meta Ad Library.",
  ],
  ["Blueprint", "Each winner taken apart shot by shot: hook, beats, pacing, text and why it works."],
  ["Consult", "Only the questions the data could not answer. Skip one and it says what it assumed."],
  ["Direct", "Every channel scored on six axes. Where to go first, and where not to go yet, with the reason."],
  ["Remake", "The winning structure rebuilt with the brand's own product, images, voice and words."],
  ["Check the law", "Every script, caption and frame against the brand's rule pack before anything renders."],
  ["Pack", "Video, caption, hashtags, posting time and checklist. A human posts it."],
];

const TOOLS: [string, string][] = [
  [
    "Claude",
    "The brain: plans the research, drops off-topic items, takes winners apart, consults, scores channels, writes, checks the law and reviews its own cuts.",
  ],
  [
    "Manus",
    "Deep research per brand (channels, competitors, community rules, each with a source) and a campaign landing page per pack.",
  ],
  ["fal", "Kling image-to-video for the remake shots."],
  ["Apify", "Meta Ad Library, TikTok, Instagram and Reddit scrapers for the winning ads and posts."],
  ["ElevenLabs", "Native voices per brand and language, music beds, sound effects and dubbing."],
  ["Gemini", "Watches whole videos with sound: the winners, and our own cuts before they ship."],
  ["Spiral", "Meta and TikTok ad intelligence: winners with transcripts and creative analysis."],
  ["Firecrawl", "Reads the brand's site into its dossier: offers, claims, colours and fonts."],
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-semibold text-[12px] text-signal uppercase tracking-[0.1em]">{children}</p>;
}

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("border-line border-t", className ?? "bg-ink")}>
      <div className="mx-auto max-w-[1440px] border-line px-4 py-20 md:border-x md:px-10 md:py-28">{children}</div>
    </section>
  );
}

const Heading = ({ text, className }: { text: string; className?: string }) => (
  <BlurText
    as="h2"
    text={text}
    className={cn(
      "mt-4 max-w-[16ch] font-semibold text-[clamp(2.4rem,5.6vw,5.2rem)] text-bone leading-[0.95] tracking-[-0.045em]",
      className,
    )}
  />
);

function Hero() {
  const list = brands();
  // the Hound remake is the one tile in full colour (the contrast streak); on phones it sits beside a.clinic
  const ORDER: Record<string, string> = {
    aclinic: "order-1",
    dynova: "hidden md:block md:order-2",
    hound: "order-2 md:order-3",
    evreon: "hidden md:block md:order-4",
  };
  return (
    <section className="relative isolate flex min-h-[max(700px,100svh)] flex-col overflow-hidden bg-signal text-white">
      <div aria-hidden className="absolute inset-0 -z-10 grid grid-cols-2 md:grid-cols-4">
        {list.map((b) => (
          <div key={b.slug} className={cn("relative overflow-hidden", ORDER[b.slug])}>
            <LoopVideo
              src={b.media.src}
              poster={b.media.poster}
              label=""
              eager
              className={b.slug === "hound" ? undefined : "grayscale contrast-125"}
            />
            {b.slug !== "hound" && <div className="absolute inset-0 bg-signal mix-blend-multiply" />}
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_10_10/0.72)_0%,rgb(10_10_10/0.45)_45%,transparent_70%),linear-gradient(180deg,rgb(10_10_10/0.45)_0%,transparent_28%,rgb(10_10_10/0.35)_55%,rgb(10_10_10/0.88)_100%)]"
      />

      <header className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 md:px-10">
        <Wordmark className="text-white" />
        <div className="flex items-center gap-3">
          <Link
            href="/brands"
            className="rounded-full bg-white px-4 py-2 font-semibold text-[#111] text-[14px] transition-colors duration-150 hover:bg-[#111] hover:text-white"
          >
            Open the live demo
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-end px-4 pb-10 md:px-10">
        <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13px] text-white ring-1 ring-white/25">
          <span className="size-1.5 rounded-full bg-white" aria-hidden />
          In colour: our remake for Hound, of a TikTok that ran at 28.8x its account median
        </p>
        <h1 className="font-semibold text-[clamp(3.1rem,8.6vw,8.4rem)] leading-[0.9] tracking-[-0.05em]">
          {/* server-rendered words that blur in with CSS at first paint: never hidden waiting for scripts */}
          {["The ads that win,", "rebuilt for your brand."].map((line, l) => (
            <span key={line} className="block">
              {line.split(" ").map((w, i) => (
                <span key={w} className="hero-word inline-block" style={{ animationDelay: `${(l * 4 + i) * 70}ms` }}>
                  {w}
                  {"\u00A0"}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] text-white/90 leading-relaxed md:text-[19px]">
          {PRODUCT_NAME} finds what already wins in your market, takes it apart shot by shot, decides where your brand
          should post, and remakes the winners with your product and your words. Checked against your legal rules.
          Posted by you.
        </p>
        <div className="mt-8">
          <UrlBar />
        </div>
      </div>

      <div className="border-white/20 border-t bg-black/25">
        <div className="mx-auto flex max-w-[1440px] items-center gap-6 overflow-hidden px-4 py-4 md:px-10">
          <span className="shrink-0 text-[13px] text-white/75">Running four real brands</span>
          <div className="marquee relative min-w-0 flex-1 overflow-hidden">
            <span className="sr-only">{list.map((b) => b.name).join(", ")}</span>
            <div className="marquee-track flex w-max items-center gap-12" aria-hidden>
              {[...list, ...list, ...list, ...list].map((b, i) => (
                <span key={`${b.slug}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap">
                  {/* biome-ignore lint/performance/noImgElement: brand marks from the committed brand assets */}
                  <img src={b.logo} alt="" className="size-7 rounded-[6px] bg-white object-contain p-1" />
                  <span className="font-semibold text-[17px] tracking-[-0.02em]">{b.name}</span>
                  <span className="text-[13px] text-white/60">{b.countries.join(", ")}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  const p = proof();
  if (!p) return null;
  return (
    <Section id="proof">
      <Eyebrow>The proof.</Eyebrow>
      <Heading text="A real winner. Our remake. Shot for shot." />
      <div className="mt-14 grid-cols-1 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WinnerCard p={p} />
        <div className="grid-cols-1 grid gap-6 bg-raised p-6 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:p-8">
          <div className="aspect-[9/16] w-full overflow-hidden rounded-[10px] bg-[#111]">
            <DubbedLoop
              src={p.remake.src}
              poster={p.remake.poster}
              label="Our remake for Hound"
              original={p.remake.language}
              dubs={p.remake.dubs}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-[13px] text-bone-3">Our remake for Hound</p>
            <p className="mt-1 font-semibold text-[22px] text-bone leading-tight tracking-[-0.02em]">
              {p.remake.title}
            </p>
            <p className="mt-4 text-[15px] text-bone-2 leading-relaxed">
              Same six beats, same timing, same hook mechanism. Hound&apos;s own app, beagle art and words. The
              creator&apos;s footage, voice, face and script are never reused.
              {p.remake.dubs.length > 0 &&
                " Switch the language on the video: the voice is re-spoken, the captions re-timed."}
            </p>
            {p.remake.review != null && (
              <p className="mt-6 font-mono text-[13px] text-bone-2">
                self-review <span className="text-[28px] text-bone">{p.remake.review}</span>/100, {p.remake.shots} shots
              </p>
            )}
            <Link
              href={p.href}
              className="mt-auto w-fit rounded-full bg-[#111] px-5 py-3 font-semibold text-[14px] text-white transition-colors duration-150 hover:bg-signal"
            >
              Open the side by side
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const clinic = brands().find((b) => b.slug === "aclinic");
  const s = stats();
  return (
    <Section id="how">
      <div className="grid-cols-1 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[10px] bg-signal p-8">
          <p className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-medium text-[#111] text-[13px]">
            <span className="size-1.5 rounded-full bg-signal" aria-hidden />
            Reading the market: {s.aclinic} real posts and ads for a.clinic
          </p>
          {clinic && (
            <div className="aspect-[9/16] w-[min(260px,60%)] overflow-hidden rounded-[14px] bg-[#111]">
              <LoopVideo
                src={clinic.media.src}
                poster={clinic.media.poster}
                label="a.clinic flagship remake, in Slovak"
              />
            </div>
          )}
        </div>
        <div>
          <Eyebrow>How it works.</Eyebrow>
          <Heading text="Seven steps. One brain. Every brand." />
          <ol className="mt-10 border-line border-t">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-line border-b py-5">
                <span className="font-mono text-[13px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-semibold text-[19px] text-bone tracking-[-0.015em]">{t}</span>
                  <span className="mt-1 block text-[15px] text-bone-2 leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

function Wall() {
  const list = brands();
  const extra = clips();
  const tiles = [
    ...extra.map((c) => ({
      key: c.src,
      src: c.src,
      poster: c.poster,
      label: c.label,
      note: undefined as string | undefined,
    })),
    ...list.map((b) => ({
      key: b.slug,
      src: b.media.src,
      poster: b.media.poster,
      label: b.name,
      note: [b.language, b.channels[0]?.label].filter(Boolean).join(", "),
    })),
  ];
  return (
    <Section id="work">
      <Eyebrow>The work.</Eyebrow>
      <Heading text="Made by the engine, for real brands." />
      <p className="mt-5 max-w-[60ch] text-[16px] text-bone-2 leading-relaxed">
        Every clip here was planned, generated, cut, captioned and reviewed by {PRODUCT_NAME}, then checked against the
        brand&apos;s rule pack. Sound off; the voices are in the brands&apos; own languages.
      </p>
      <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((t) => (
          <li key={t.key} className="group relative aspect-[9/16] overflow-hidden rounded-[10px] bg-[#111]">
            <LoopVideo src={t.src} poster={t.poster} label={t.label} />
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgb(0_0_0/0.75),transparent)] p-3 pt-10 text-white">
              <p className="font-semibold text-[15px] capitalize">{t.label}</p>
              {t.note && <p className="text-[12px] text-white/75">{t.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Stats() {
  const s = stats();
  const cells: [number, string][] = [
    [s.items, `real competitor ads and posts researched (kept from ${s.found} found)`],
    [s.winners, "winning videos taken apart shot by shot"],
    [s.sources, "sources, from TikTok to the Meta Ad Library"],
    [s.brands, "real brands on one engine"],
    [s.languages.length, `languages: ${s.languages.join(", ")}`],
  ];
  return (
    <section className="border-line border-t bg-ink">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 border-line md:grid-cols-5 md:border-x">
        {cells.map(([n, label], i) => (
          <div
            key={label}
            className={cn(
              "border-line border-b p-5 md:border-b-0 md:p-8",
              i % 2 === 0 && "border-r md:border-r",
              i % 2 === 1 && "md:border-r",
              i === cells.length - 1 && "col-span-2 border-r-0 md:col-span-1",
            )}
          >
            <CountUp
              to={n}
              className="block font-semibold text-[clamp(2.6rem,5vw,4.4rem)] text-bone tabular-nums leading-none tracking-[-0.04em]"
            />
            <p className="mt-3 text-[14px] text-bone-2 leading-snug">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Brands() {
  return (
    <Section id="brands">
      <Eyebrow>Four brands.</Eyebrow>
      <Heading text="Same engine. Different answers." />
      <ul className="mt-12 border-line border-t">
        {brands().map((b) => (
          <li
            key={b.slug}
            data-testid={`brand-${b.slug}`}
            className="grid-cols-1 grid gap-6 border-line border-b py-8 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
          >
            <div className="aspect-[9/16] w-[160px] overflow-hidden rounded-[10px] bg-[#111] md:w-full">
              <LoopVideo src={b.media.src} poster={b.media.poster} label={`${b.name} flagship remake`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                {/* biome-ignore lint/performance/noImgElement: brand marks from the committed brand assets */}
                <img
                  src={b.logo}
                  alt=""
                  className="size-9 rounded-[8px] border border-line bg-white object-contain p-1"
                />
                <h3 className="font-semibold text-[28px] text-bone tracking-[-0.03em]">{b.name}</h3>
              </div>
              <p className="mt-3 text-[16px] text-bone-2">{b.oneLiner}</p>
              {b.title && (
                <p className="mt-5 text-[15px] text-bone">
                  <span className="text-bone-3">Flagship, {b.language}: </span>
                  {b.title}
                </p>
              )}
              {b.review != null && <p className="mt-2 font-mono text-[13px] text-bone-2">self-review {b.review}/100</p>}
              <Link
                href={`/brands/${b.slug}`}
                className="mt-5 inline-block text-[14px] text-bone underline underline-offset-4"
              >
                Open {b.name} in the live demo
              </Link>
            </div>
            <div>
              <p className="font-semibold text-[12px] text-bone-3 uppercase tracking-[0.08em]">Where to go first</p>
              <ol className="mt-3 flex flex-col gap-2">
                {b.channels.map((c, i) => (
                  <li key={c.label} className="flex items-center gap-3 text-[15px]">
                    <span className="w-5 font-mono text-[12px] text-bone-3">{i + 1}</span>
                    <span className="flex-1 text-bone">{c.label}</span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-raised-2">
                      <span className="block h-full bg-[#111]" style={{ width: `${c.score}%` }} />
                    </span>
                    <span className="w-7 text-right font-mono text-[12px] text-bone-2">{c.score}</span>
                  </li>
                ))}
              </ol>
              {b.notNow && (
                <p className="mt-5 text-[14px] text-bone-2 leading-relaxed">
                  <span className="font-semibold text-bone line-through decoration-signal">{b.notNow.label}</span>: not
                  now. {b.notNow.reason}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Law() {
  const c = compliance();
  if (!c) return null;
  return (
    <Section id="law" className="bg-[#111]">
      <div className="text-white">
        <Eyebrow>The law.</Eyebrow>
        <BlurText
          as="h2"
          text="Some ads should never run. It knows which."
          className="mt-4 block max-w-[18ch] font-semibold text-[clamp(2.4rem,5.6vw,5.2rem)] leading-[0.95] tracking-[-0.045em]"
        />
        <div className="mt-12 grid-cols-1 grid gap-px overflow-hidden rounded-[10px] bg-white/15 md:grid-cols-3">
          <div className="bg-[#111] p-6 md:p-8">
            <p className="font-mono text-[12px] text-signal">a.clinic / Meta paid ads</p>
            <p className="mt-3 font-semibold text-[24px] line-through decoration-signal tracking-[-0.02em]">Refused</p>
            <p className="mt-3 text-[15px] text-white/80 leading-relaxed">{c.refused}</p>
          </div>
          <div className="bg-[#111] p-6 md:p-8">
            <p className="font-mono text-[12px] text-signal">a.clinic / rule RX1</p>
            <p className="mt-3 font-semibold text-[24px] tracking-[-0.02em]">Drug names never appear</p>
            <p className="mt-3 text-[15px] text-white/80 leading-relaxed">
              Slovak and Czech law ban advertising prescription medicines to the public, so no script, caption or frame
              names one. The rule runs before anything renders.
            </p>
          </div>
          {c.finding && (
            <div className="bg-[#111] p-6 md:p-8">
              <p className="font-mono text-[12px] text-signal">a.clinic / rule {c.finding.ruleId}, sent back</p>
              <p className="mt-3 font-semibold text-[20px] leading-snug tracking-[-0.01em]">
                &ldquo;{c.finding.excerpt}&rdquo;
              </p>
              <p className="mt-3 text-[15px] text-white/80 leading-relaxed">{c.finding.message}</p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function BuiltWith() {
  return (
    <Section id="stack">
      <Eyebrow>Built with.</Eyebrow>
      <Heading text="Real tools, doing real work." />
      <ul className="mt-12 grid grid-cols-1 border-line border-t border-l sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map(([name, line]) => (
          <li key={name} className="border-line border-r border-b p-6">
            <p className="font-semibold text-[20px] text-bone tracking-[-0.02em]">{name}</p>
            <p className="mt-2 text-[14px] text-bone-2 leading-relaxed">{line}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Cta() {
  return (
    <section className="bg-signal text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-10 px-4 py-24 md:px-10 md:py-32">
        <BlurText
          as="h2"
          text="See it run on four real brands."
          className="block max-w-[14ch] font-semibold text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.92] tracking-[-0.05em]"
        />
        <Magnet>
          <Link
            href="/brands"
            className="inline-flex rounded-full bg-white px-8 py-4 font-semibold text-[#111] text-[18px] transition-colors duration-150 hover:bg-[#111] hover:text-white"
          >
            Open the live demo
          </Link>
        </Magnet>
        <p className="max-w-[60ch] text-[14px] text-white/85">
          The demo shows recorded runs on the four brands. Nothing is posted and no money is spent without a human.
        </p>
        <p className="max-w-[60ch] text-[14px] text-white/85">
          <span className="font-semibold text-white">What&apos;s next:</span> a daily or monthly research refresh per
          brand, so the plan keeps up with the market.
        </p>
      </div>
    </section>
  );
}

export function Site() {
  return (
    <>
      <main>
        <Hero />
        <Proof />
        <HowItWorks />
        <Wall />
        <Stats />
        <Brands />
        <Law />
        <BuiltWith />
        <Cta />
      </main>
      <footer className="border-line border-t bg-ink">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-bone-2 md:px-10">
          <Wordmark />
          <p>Built at 10X Your Brand (Slush&apos;D x Manus), Istanbul, 12 Oct 2026.</p>
        </div>
      </footer>
    </>
  );
}
