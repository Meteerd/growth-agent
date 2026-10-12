import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { CHANNEL_LABELS, type DemoRunBundle, SEED_BRANDS } from "@/contracts";
import { logoOnDark } from "@/lib/client/brandAssets";
import { SOURCE_LABELS, secs } from "@/lib/client/format";
import { DATA_MODE } from "@/lib/client/mode";
import aclinicSheet from "../../../docs/renders/aclinic-flagship.jpg";
import dynovaSheet from "../../../docs/renders/dynova-flagship.jpg";
import houndSheet from "../../../docs/renders/hound-flagship.jpg";

// Lane A's flagship renders (A17): contact sheets of our own output, one frame per shot in cut order.
const CUTS = [
  { slug: "hound", sheet: houndSheet },
  { slug: "aclinic", sheet: aclinicSheet },
  { slug: "dynova", sheet: dynovaSheet },
];

// read, not imported: scraped ad text can hold lone surrogate escapes that JSON.parse accepts and the bundler rejects
function load(slug: string): DemoRunBundle | undefined {
  const f = path.resolve("src/contracts/fixtures/live/showcase", `${slug}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : undefined;
}

const WORDS: Record<number, string> = { 2: "two", 3: "three", 4: "four" };
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
const LANGUAGE: Record<string, string> = { en: "English", sk: "Slovak", cs: "Czech", tr: "Turkish" };

// Server-side only: everything shown is read from the showcase fixtures, never invented.
function cut(b: DemoRunBundle) {
  const c = b.concepts.find((x) => x.blueprintId && !x.variantOf && x.status === "rendered");
  const bp = c && b.blueprints.find((x) => x.id === c.blueprintId);
  const ev = bp && b.evidence.find((x) => x.id === bp.evidenceId);
  const brand = SEED_BRANDS.find((x) => x.id === b.brand.id);
  if (!c || !bp || !ev || !brand) return undefined;
  const review = b.reviews.filter((r) => r.conceptId === c.id).at(-1);
  return {
    brand,
    title: c.title,
    channel: CHANNEL_LABELS[c.channel],
    language: LANGUAGE[c.language] ?? c.language,
    length: c.shots.reduce((s, x) => s + x.durationSec, 0),
    shots: c.shots.length,
    structure: bp.structure.replaceAll("_", " "),
    source: SOURCE_LABELS[ev.source],
    outlier: ev.metrics.outlierScore,
    review: review && { overall: review.overall, minShot: Math.min(...review.perShot.map((p) => p.score)) },
    // the showcase runs are imported by the engine; mock mode has no such run, so it opens the brand instead
    href: DATA_MODE === "live" ? `/runs/${b.run.id}/blueprints/${bp.id}` : `/brands/${brand.slug}`,
  };
}

export function Cuts() {
  const rows = CUTS.flatMap(({ slug, sheet }) => {
    const b = load(slug);
    const d = b && cut(b);
    return d ? [{ ...d, sheet }] : [];
  });
  if (!rows.length) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-[var(--spacing-section-sm)] md:px-8" data-testid="cuts">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[12px] text-bone-3">01</span>
        <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] tracking-[-0.03em]">
          Same engine. {cap(WORDS[rows.length] ?? String(rows.length))} brands, {WORDS[rows.length] ?? rows.length}{" "}
          languages.
        </h2>
      </div>
      <p className="mt-3 max-w-2xl pl-9 text-[14px] text-bone-2">
        Each cut remakes a different winning video under that brand&apos;s own rule pack. One frame per shot, left to
        right, as the agent cut it and then watched it back.
      </p>
      <ul className="mt-10 border-line border-t">
        {rows.map((d) => (
          <li
            key={d.brand.id}
            className="grid-cols-1 grid gap-5 border-line border-b py-6 md:grid-cols-12 md:gap-8"
            data-testid={`cut-${d.brand.slug}`}
          >
            <div className="flex flex-col gap-3 md:col-span-4">
              <div className="flex items-center gap-3">
                {/* biome-ignore lint/performance/noImgElement: small brand marks */}
                <img src={logoOnDark(d.brand)} alt="" className="size-8 rounded-[4px] object-contain" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[16px]">{d.brand.name}</h3>
                  <p className="text-[12px] text-bone-3">
                    {d.language} / {d.brand.countries.join(", ")}
                  </p>
                </div>
              </div>
              <p className="font-semibold text-[17px] leading-snug tracking-[-0.01em]">{d.title}</p>
              <dl className="grid grid-cols-3 gap-3 border-line border-t pt-3 text-[12px]">
                <div>
                  <dt className="text-bone-3">Remakes</dt>
                  <dd className="mt-0.5 text-bone">
                    {d.source}
                    {d.outlier ? `, ${d.outlier}x median` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-bone-3">Cut</dt>
                  <dd className="mt-0.5 text-bone">
                    {d.shots} shots, {secs(d.length)}
                  </dd>
                </div>
                <div>
                  <dt className="text-bone-3">Self-review</dt>
                  <dd className="mt-0.5 font-mono text-bone">{d.review ? `${d.review.overall}/100` : "none"}</dd>
                </div>
              </dl>
              <p className="text-[12px] text-bone-3">
                {d.channel}, {d.structure}
                {d.review && d.review.minShot >= 80 ? ". Every shot scored 80 or more." : "."}
              </p>
              <Link
                href={d.href}
                className="mt-auto self-start text-[13px] text-bone underline decoration-bone-4 underline-offset-4"
              >
                {DATA_MODE === "live" ? "Open the side by side" : `Open ${d.brand.name}`}
              </Link>
            </div>
            <div className="order-first overflow-x-auto rounded-[4px] bg-viewer md:order-none md:col-span-8">
              {/* biome-ignore lint/performance/noImgElement: a committed contact sheet, already sized */}
              <img
                src={d.sheet.src}
                width={d.sheet.width}
                height={d.sheet.height}
                alt={`${d.brand.name} remake, one frame per shot`}
                loading="lazy"
                className="h-[200px] w-auto max-w-none md:h-auto md:w-full"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
