import { SEED_BRANDS } from "@/contracts";
import houndRecorded from "@/contracts/fixtures/live/runs/hound.json";
import { logoOnDark } from "@/lib/client/brandAssets";
import { countryName, VERTICAL_LABELS } from "@/lib/client/format";
import { PRODUCT_NAME } from "@/lib/client/product";
import { displayHost } from "@/lib/client/url";
import { ExampleStrip, type Winner } from "./ExampleStrip";

const LOOP: [string, string][] = [
  ["Enter", "Paste a URL. The brand exists in seconds."],
  ["Connect", "Revenue, analytics, ads. Optional; day zero works."],
  ["Gather", "Site, competitors, winning ads and posts, reviews."],
  ["Watch", "Winning videos taken apart shot by shot."],
  ["Consult", "Only the questions the data could not answer."],
  ["Direct", "Where to go, in what order, and where not to."],
  ["Produce", "Remakes of proven structures, keyframes first."],
  ["Check", "Every line against the brand's legal rules."],
  ["Pack", "Ready to post: video, caption, time, checklist."],
  ["Learn", "Real results come back and sharpen the next run."],
];

// Server-side only: the recorded live research pass for Hound (real posts, real numbers).
function winners(): Winner[] {
  type E = {
    id: string;
    source: Winner["source"];
    title: string;
    thumbnailUrl?: string;
    url?: string;
    metrics: { views?: number; outlierScore?: number; daysRunning?: number };
  };
  return (houndRecorded.evidence as E[])
    .filter((e) => e.thumbnailUrl)
    .sort((a, b) => (b.metrics.outlierScore ?? 0) - (a.metrics.outlierScore ?? 0))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      source: e.source,
      title: e.title,
      thumbnailUrl: e.thumbnailUrl!,
      url: e.url,
      views: e.metrics.views,
      outlier: e.metrics.outlierScore,
      daysRunning: e.metrics.daysRunning,
    }));
}

export function Example() {
  const hound = SEED_BRANDS.find((b) => b.slug === "hound")!;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-[var(--spacing-section-sm)] md:px-8">
      <div className="rounded-panel bg-raised p-4 shadow-[inset_0_0_0_1px_var(--color-line)] md:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-line border-b pb-4">
          <h2 className="font-display text-[26px] leading-tight md:text-[32px]">
            A real example: Hound, a dog-training app
          </h2>
          <p className="text-[13px] text-bone-2">Recorded live research, 11 Oct 2026</p>
        </div>
        <ExampleStrip winners={winners()} brandArt={hound.dossier.visual.referenceImages ?? []} />
      </div>
    </section>
  );
}

export function Loop() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8">
      <SectionHead index="01" title="One engine runs the whole go-to-market." />
      <ol className="mt-10 grid grid-cols-2 border-line border-t md:grid-cols-5">
        {LOOP.map(([t, d], i) => (
          <li key={t} className="border-line border-b p-4 md:border-r md:p-5 md:[&:nth-child(5n)]:border-r-0">
            <span className="font-mono text-[11px] text-bone-3">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 font-semibold text-[19px] tracking-[-0.015em]">{t}</h3>
            <p className="mt-1.5 text-[13px] text-bone-2">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Brands() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8">
      <SectionHead index="02" title="Four real brands. Four legal regimes." />
      <ul className="grid-cols-1 mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEED_BRANDS.map((b) => {
          const cover = b.dossier.visual.referenceImages?.[0];
          return (
            <li
              key={b.id}
              className="flex flex-col overflow-hidden rounded-panel bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              <div className="aspect-[16/10] bg-raised-2">
                {/* biome-ignore lint/performance/noImgElement: brand-owned images from the engine asset route */}
                {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  {/* biome-ignore lint/performance/noImgElement: small brand marks */}
                  <img src={logoOnDark(b)} alt="" className="size-8 rounded-[4px] object-contain" />
                  <div>
                    <h3 className="font-semibold text-[16px]">{b.name}</h3>
                    <p className="font-mono text-[11px] text-bone-3">{displayHost(b.url)}</p>
                  </div>
                </div>
                <p className="text-[13px] text-bone-2">{b.dossier.oneLiner}</p>
                <dl className="mt-auto grid grid-cols-2 gap-3 border-line border-t pt-3 text-[12px]">
                  <div>
                    <dt className="text-bone-3">Vertical</dt>
                    <dd className="mt-0.5 text-bone">{VERTICAL_LABELS[b.vertical]}</dd>
                  </div>
                  <div>
                    <dt className="text-bone-3">Markets</dt>
                    <dd className="mt-0.5 text-bone">{b.countries.map(countryName).join(", ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-bone-3">Rule pack</dt>
                    <dd className="mt-0.5 font-mono text-[11.5px] text-bone">{b.rulePack}</dd>
                  </div>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const RULES: [string, string][] = [
  [
    "No invented numbers.",
    "Views, revenue and competitor facts come from a source or they do not appear. An empty chart says waiting for first metrics.",
  ],
  [
    "Remake, never copy.",
    "Nexus learns hook, pacing and structure from winners. It never reuses their footage, voice, faces or words.",
  ],
  [
    "Nothing posts without you.",
    "You get a ready-to-post pack. You post it, or you click post yourself where a platform allows it.",
  ],
  [
    "Every paid call is capped.",
    "Each provider call goes through a spend ledger with a hard budget. Estimates show before every render.",
  ],
];

export function Rules() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8">
      <SectionHead index="03" title="House rules." />
      <ul className="grid-cols-1 mt-10 grid border-line border-t md:grid-cols-2">
        {RULES.map(([t, d], i) => (
          <li
            key={t}
            className="grid grid-cols-[36px_1fr] gap-4 border-line border-b py-6 md:pr-10 md:[&:nth-child(odd)]:border-r md:[&:nth-child(even)]:pl-10"
          >
            <span className="font-mono text-[11px] text-bone-3">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-semibold text-[20px] tracking-[-0.015em]">{t}</h3>
              <p className="mt-2 max-w-md text-[14px] text-bone-2">{d}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-6 max-w-[1440px] px-4 pb-10 md:px-8">
      <div className="flex flex-col gap-4 border-line border-t pt-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-[32px] leading-none">{PRODUCT_NAME}</p>
          <p className="mt-2 max-w-sm text-[13px] text-bone-2">
            Claude decides. Manus researches. Apify, Firecrawl and fal gather and render. Runs on a laptop.
          </p>
        </div>
        <p className="text-[12px] text-bone-3">10X Your Brand / Slush&apos;D x Manus / Istanbul, 12 Oct 2026</p>
      </div>
    </footer>
  );
}

function SectionHead({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-[12px] text-bone-3">{index}</span>
      <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] tracking-[-0.03em]">{title}</h2>
    </div>
  );
}
