import { DemoBadge } from "@/components/ui/Badge";
import { DEMO_RUNS, SEED_BRANDS } from "@/contracts";
import { logoOnDark } from "@/lib/client/brandAssets";
import { countryName, VERTICAL_LABELS } from "@/lib/client/format";
import { PRODUCT_NAME } from "@/lib/client/product";
import { PURPOSE_COLOR, PURPOSE_LABEL } from "@/lib/client/purpose";

const LOOP: [string, string][] = [
  ["Enter", "Paste a URL. The brand exists in seconds."],
  ["Connect", "Revenue, analytics, ads. Optional; day zero works."],
  ["Gather", "Site, competitors, winning ads and posts, reviews."],
  ["Watch", "Winning videos taken apart shot by shot."],
  ["Consult", "Only the questions the data could not answer."],
  ["Direct", "Where to go, in what order, and where not to."],
  ["Produce", "Remakes of proven structures, keyframes first."],
  ["Check", "Every line against the brand's legal rules."],
  ["Pack", "Ready-to-post: video, caption, time, checklist."],
  ["Learn", "Real results come back and sharpen the next run."],
];

export function Loop() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8 md:py-24">
      <SectionHead index="01" label="The loop" title="One brain runs the whole go-to-market." />
      <ol className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-line md:grid-cols-5">
        {LOOP.map(([t, d], i) => (
          <li key={t} className="group relative bg-ink/90 p-5 transition-colors duration-300 hover:bg-raised md:p-6">
            <span className="font-mono text-[10.5px] text-bone-3">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-6 font-serif text-[28px] leading-none">{t}</h3>
            <p className="mt-3 text-bone-2 text-ui">{d}</p>
            <span
              aria-hidden
              className="absolute inset-x-5 top-0 h-px origin-left scale-x-0 bg-signal transition-transform duration-500 ease-out group-hover:scale-x-100"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Remake() {
  const bp = DEMO_RUNS.hound.blueprints[0];
  const concept = DEMO_RUNS.hound.concepts.find((c) => c.id === "concept_hound_1");
  const total = bp.durationSec;
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8 md:py-24">
      <SectionHead
        index="02"
        label="Watch, dissect, remake"
        title="It watches the winners, then rebuilds them for you."
        aside={<DemoBadge />}
      />
      <div className="glass mt-14 overflow-hidden p-5 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="mono-label">winning ad / 14.2x the account median / {total}s</p>
          <p className="max-w-md text-bone-2 text-ui">{bp.hook.whyItStops}</p>
        </div>
        <Strip
          shots={bp.shots.map((s) => ({ t0: s.t0, t1: s.t1, purpose: s.purpose, text: s.onScreenText ?? s.action }))}
          total={total}
        />
        <div className="my-4 flex items-center gap-3 font-mono text-[10.5px] text-bone-3">
          <span className="h-px flex-1 bg-line" />
          same structure, same timing, our brand
          <span className="h-px flex-1 bg-line" />
        </div>
        <Strip
          remake
          total={total}
          shots={bp.shots.map((s, i) => ({
            t0: s.t0,
            t1: s.t1,
            purpose: s.purpose,
            text: concept?.shots[i]?.onScreenText ?? "",
          }))}
        />
        <p className="mt-6 font-mono text-[11px] text-bone-3">
          Structure only. We never reuse their footage, music, voice, faces or words.
        </p>
      </div>
    </section>
  );
}

function Strip({
  shots,
  total,
  remake,
}: {
  shots: { t0: number; t1: number; purpose: keyof typeof PURPOSE_COLOR; text: string }[];
  total: number;
  remake?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-1">
      {shots.map((s) => (
        <div key={s.t0} className="min-w-0" style={{ flex: `${s.t1 - s.t0} 1 0` }}>
          <div
            className="relative h-20 overflow-hidden rounded-[6px] md:h-28"
            style={{
              background: remake
                ? `linear-gradient(180deg, ${PURPOSE_COLOR[s.purpose]}2e, #0c0e13)`
                : `repeating-linear-gradient(115deg, ${PURPOSE_COLOR[s.purpose]}1c 0 1px, transparent 1px 7px), #0c0e13`,
              boxShadow: `inset 0 0 0 1px ${PURPOSE_COLOR[s.purpose]}${remake ? "66" : "33"}`,
            }}
          >
            <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[11px] text-bone leading-tight md:text-[12px]">
              {s.text}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: PURPOSE_COLOR[s.purpose] }} />
            <span className="hidden truncate font-mono text-[10px] text-bone-2 uppercase sm:inline">
              {PURPOSE_LABEL[s.purpose]}
            </span>
            <span className="ml-auto hidden font-mono text-[10px] text-bone-3 md:inline">{s.t0}s</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Brands() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8 md:py-24">
      <SectionHead index="03" label="Many brands, one brain" title="Four real brands. Four legal regimes." />
      <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEED_BRANDS.map((b) => (
          <li key={b.id} className="glass-flat flex flex-col gap-6 p-6">
            <div className="flex items-center gap-3">
              {b.dossier.visual.logoUrl && (
                // biome-ignore lint/performance/noImgElement: small brand marks served by the engine asset route
                <img src={logoOnDark(b)} alt="" className="size-10 rounded-[10px] bg-bone/5 object-contain p-1.5" />
              )}
              <div>
                <h3 className="font-medium text-body">{b.name}</h3>
                <p className="font-mono text-[11px] text-bone-3">{new URL(b.url).hostname}</p>
              </div>
            </div>
            <p className="text-bone-2 text-ui">{b.dossier.oneLiner}</p>
            <dl className="mt-auto grid grid-cols-2 gap-3 border-line border-t pt-4 font-mono text-[11px]">
              <div>
                <dt className="text-bone-3">vertical</dt>
                <dd className="mt-0.5 text-bone">{VERTICAL_LABELS[b.vertical]}</dd>
              </div>
              <div>
                <dt className="text-bone-3">markets</dt>
                <dd className="mt-0.5 text-bone">{b.countries.map(countryName).join(", ")}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-bone-3">rule pack</dt>
                <dd className="mt-0.5 text-bone">{b.rulePack}</dd>
              </div>
            </dl>
          </li>
        ))}
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
    "The agent learns hook, pacing and structure from winners. It never reuses their footage, voice, faces or words.",
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
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8 md:py-24">
      <SectionHead index="04" label="House rules" title="It is honest by construction." />
      <ul className="mt-14 grid gap-x-10 gap-y-10 md:grid-cols-2">
        {RULES.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[40px_1fr] gap-4 border-line border-t pt-6">
            <span className="font-mono text-[11px] text-signal">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-serif text-[30px] leading-tight">{t}</h3>
              <p className="mt-3 max-w-md text-bone-2 text-body">{d}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-10 max-w-[1440px] px-4 pb-10 md:px-8">
      <div className="flex flex-col gap-6 border-line border-t pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-serif text-[40px] leading-none md:text-[64px]">{PRODUCT_NAME}</p>
          <p className="mt-3 max-w-sm text-bone-2 text-ui">
            Claude decides. Manus researches. Apify, Firecrawl and fal gather and render. Runs on a laptop.
          </p>
        </div>
        <p className="font-mono text-[11px] text-bone-3">
          10X Your Brand / Slush&apos;D x Manus / Istanbul, 12 Oct 2026
        </p>
      </div>
    </footer>
  );
}

function SectionHead({
  index,
  label,
  title,
  aside,
}: {
  index: string;
  label: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mono-label">
          <span className="text-bone-3">{index}</span> / {label}
        </p>
        <h2 className="mt-4 max-w-3xl font-serif text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] tracking-[-0.01em]">
          {title}
        </h2>
      </div>
      {aside && <div className="self-start md:self-auto">{aside}</div>}
    </div>
  );
}
