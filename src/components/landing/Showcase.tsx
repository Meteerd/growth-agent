import Link from "next/link";
import { Wordmark } from "@/components/shell/Header";
import { brands, proofFor, stats } from "./data";
import { DubbedLoop } from "./LoopVideo";
import { WinnerCard } from "./Winner";

// The results Mete shows right after the landing: for every brand, the winner taken apart, our remake, where the plan
// sends it and the latest self-review. Everything is read from the recorded showcase runs.

export function Showcase() {
  const s = stats();
  const list = brands().flatMap((b) => {
    const p = proofFor(b.slug);
    return p ? [p] : [];
  });
  return (
    <>
      <header className="border-line border-b bg-raised">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-10">
          <Wordmark />
          <nav className="flex items-center gap-2 text-[14px]">
            <Link href="/" className="hidden rounded-full px-3 py-2 text-bone-2 hover:text-bone sm:block">
              How it works
            </Link>
            <Link href="/brands" className="rounded-full bg-[#111] px-4 py-2 font-semibold text-white hover:bg-signal">
              Open the live demo
            </Link>
          </nav>
        </div>
      </header>
      <main className="bg-raised">
        <section className="mx-auto max-w-[1440px] border-line px-4 py-16 md:border-x md:px-10 md:py-20">
          <p className="font-semibold text-[12px] text-signal uppercase tracking-[0.1em]">Results.</p>
          <h1 className="mt-4 max-w-[18ch] font-semibold text-[clamp(2.6rem,6vw,5.6rem)] text-bone leading-[0.95] tracking-[-0.045em]">
            {list.length} brands. {list.length} winners taken apart. {list.length} remakes.
          </h1>
          <p className="mt-6 max-w-[64ch] text-[17px] text-bone-2 leading-relaxed">
            From {s.items} real competitor ads and posts ({s.found} found, the off-topic ones dropped), the engine took{" "}
            {s.winners} winners apart shot by shot and rebuilt one per brand in {s.languages.join(", ")}, under each
            brand&apos;s own legal rules.
          </p>
          <nav className="mt-8 flex flex-wrap gap-2">
            {list.map((p, i) => (
              <a
                key={p.slug}
                href={`#${p.slug}`}
                className="rounded-full px-3.5 py-1.5 text-[14px] text-bone shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-raised-2"
              >
                <span className="font-mono text-[12px] text-bone-3">{String(i + 1).padStart(2, "0")}</span> {p.name}
              </a>
            ))}
          </nav>
        </section>

        {list.map((p, i) => (
          <section key={p.slug} id={p.slug} className="border-line border-t" data-testid={`result-${p.slug}`}>
            <div className="mx-auto max-w-[1440px] border-line px-4 py-14 md:border-x md:px-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-semibold text-[12px] text-signal uppercase tracking-[0.1em]">
                  {String(i + 1).padStart(2, "0")} / {p.name}
                </p>
                <p className="text-[13px] text-bone-3">
                  {p.remake.channel}, {p.remake.language.toUpperCase()}
                  {p.remake.dubs.length ? ` + ${p.remake.dubs.map((d) => d.lang.toUpperCase()).join(", ")} dub` : ""},{" "}
                  {p.winner.structure}
                </p>
              </div>
              <h2 className="mt-3 max-w-[30ch] font-semibold text-[clamp(1.7rem,3vw,2.6rem)] text-bone leading-[1.05] tracking-[-0.03em]">
                {p.remake.title}
              </h2>
              <div className="mt-8 grid-cols-1 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
                <WinnerCard p={p} compact />
                <div className="flex items-center justify-center bg-[#111] p-4">
                  <div className="aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[8px]">
                    <DubbedLoop
                      src={p.remake.src}
                      poster={p.remake.poster}
                      label={`Our remake for ${p.name}`}
                      original={p.remake.language}
                      dubs={p.remake.dubs}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-6 bg-raised p-6 md:p-8">
                  <div>
                    <p className="font-semibold text-[12px] text-bone-3 uppercase tracking-[0.08em]">
                      Where to go first
                    </p>
                    <ol className="mt-3 flex flex-col gap-2">
                      {p.channels.map((c, n) => (
                        <li key={c.label} className="flex items-center gap-3 text-[15px]">
                          <span className="w-4 font-mono text-[12px] text-bone-3">{n + 1}</span>
                          <span className="flex-1 text-bone">{c.label}</span>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-raised-2">
                            <span className="block h-full bg-[#111]" style={{ width: `${c.score}%` }} />
                          </span>
                          <span className="w-7 text-right font-mono text-[12px] text-bone-2">{c.score}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {p.notNow.length > 0 && (
                    <div>
                      <p className="font-semibold text-[12px] text-bone-3 uppercase tracking-[0.08em]">Not now</p>
                      <ul className="mt-2 flex flex-col gap-2 text-[13.5px] text-bone-2 leading-snug">
                        {p.notNow.map((n) => (
                          <li key={n.label}>
                            <span className="font-medium text-bone line-through decoration-signal">{n.label}</span>:{" "}
                            {n.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-4 border-line border-t pt-5">
                    {p.remake.review != null && (
                      <p className="font-mono text-[12px] text-bone-3">
                        latest self-review
                        <span className="block font-semibold font-sans text-[40px] text-bone leading-none tracking-[-0.03em]">
                          {p.remake.review}
                          <span className="text-[18px] text-bone-3">/100</span>
                        </span>
                      </p>
                    )}
                    <Link
                      href={p.href}
                      className="rounded-full bg-[#111] px-4 py-2.5 font-semibold text-[13px] text-white hover:bg-signal"
                    >
                      Open the side by side
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
