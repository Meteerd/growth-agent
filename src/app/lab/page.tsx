import type { Metadata } from "next";
import { FieldControls } from "./FieldControls";
import { Kit } from "./Kit";

export const metadata: Metadata = { title: "Lab" };

const COLORS: [string, string, string][] = [
  ["ink", "#06070A", "bg-ink"],
  ["raised", "#0C0E13", "bg-raised"],
  ["raised-2", "#12151C", "bg-raised-2"],
  ["bone", "#ECE7DD", "bg-bone"],
  ["bone-2", "64%", "bg-bone-2"],
  ["bone-3", "50%", "bg-bone-3"],
  ["bone-4", "30%", "bg-bone-4"],
  ["signal", "#D4FF3A", "bg-signal"],
  ["violet", "#5B3CFF", "bg-violet"],
  ["cyan", "#3CE0FF", "bg-cyan"],
  ["pass", "#7CFFB2", "bg-pass"],
  ["warn", "#FFC85C", "bg-warn"],
  ["fail", "#FF5C7A", "bg-fail"],
];

const TYPE: [string, string, string][] = [
  ["display-xl", "96 / 1.0 / -0.012em", "font-serif text-display-xl"],
  ["display", "72 / 1.0 / -0.01em", "font-serif text-display"],
  ["title", "40 / 1.05", "font-serif text-title"],
  ["heading", "22 / 1.25", "font-sans text-heading font-medium"],
  ["body", "15 / 1.55", "font-sans text-body"],
  ["ui", "13 / 1.4", "font-sans text-ui"],
];

const SPACE = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];

export default function LabPage() {
  return (
    <main className="mx-auto max-w-[1320px] px-4 pt-16 pb-32 md:px-12">
      <header className="flex flex-col gap-4 border-line border-b pb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-label">Instrument check / 01</p>
          <h1 className="mt-3 font-serif text-title text-gradient-bone md:text-display">The lab</h1>
        </div>
        <p className="max-w-sm text-bone-2 text-ui">
          Every token, layer and component of the cockpit in one place. If it is not here, it is not in the product.
        </p>
      </header>

      <Section index="00" title="Field">
        <FieldControls />
        <p className="mt-3 mono-label">
          Raw WebGL2, domain-warped fbm, iso-lines, cursor bend. DPR capped at 1.5 and rendered at 0.75 of it. Pauses
          when hidden.
        </p>
      </Section>

      <Section index="01" title="Colour">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {COLORS.map(([name, value, cls]) => (
            <div key={name} className="glass-flat overflow-hidden p-1.5">
              <div className={`${cls} h-16 rounded-[10px] hairline`} />
              <div className="flex items-baseline justify-between px-1.5 pt-2.5 pb-1">
                <span className="text-ui">{name}</span>
                <span className="font-mono text-[10px] text-bone-3">{value}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 rounded-full bg-[linear-gradient(90deg,var(--color-violet),var(--color-cyan),var(--color-signal))]" />
        <p className="mt-2 mono-label">
          Spectral ramp: thinking state and charts only. Signal: live activity, primary action, focus.
        </p>
      </Section>

      <Section index="02" title="Type">
        <div className="flex flex-col divide-y divide-line">
          {TYPE.map(([name, spec, cls]) => (
            <div key={name} className="grid gap-2 py-5 md:grid-cols-[160px_1fr] md:items-baseline">
              <div>
                <p className="mono-label">{name}</p>
                <p className="mt-1 font-mono text-[10px] text-bone-3">{spec}</p>
              </div>
              <p className={cls}>Where should Hound show up?</p>
            </div>
          ))}
          <div className="grid gap-2 py-5 md:grid-cols-[160px_1fr] md:items-baseline">
            <p className="mono-label">mono / data</p>
            <p className="font-mono text-ui">run_01J9 · 00:42.118 · $0.0412 · 3,214 views · outlier 7.4x</p>
          </div>
          <div className="grid gap-2 py-5 md:grid-cols-[160px_1fr] md:items-baseline">
            <p className="mono-label">micro label</p>
            <p className="mono-label">Why I am asking / evidence 3</p>
          </div>
          <div className="grid gap-2 py-5 md:grid-cols-[160px_1fr] md:items-baseline">
            <p className="mono-label">serif italic</p>
            <p className="font-serif text-title italic">not now, and here is why</p>
          </div>
        </div>
      </Section>

      <Section index="03" title="Space and radius">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {SPACE.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-12 font-mono text-[10px] text-bone-3">{s * 4}px</span>
                <span className="h-2 rounded-cell bg-bone-4" style={{ width: s * 4 * 2 }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              ["cell", "rounded-cell", "2"],
              ["card", "rounded-card", "10"],
              ["panel", "rounded-panel", "14"],
              ["chip", "rounded-chip", "full"],
            ].map(([n, cls, v]) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div className={`${cls} aspect-square w-full bg-raised-2 hairline`} />
                <span className="mono-label">
                  {n} {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section index="04" title="Layers">
        <div className="relative grid gap-4 md:grid-cols-3">
          <div className="glass p-6">
            <p className="mono-label">glass</p>
            <p className="mt-3 text-body">
              Blur 24, saturate 140, inner light edge, inner falloff, outer lift. Two or three per screen.
            </p>
          </div>
          <div className="glass-flat p-6">
            <p className="mono-label">glass-flat</p>
            <p className="mt-3 text-body">
              No blur. For dense lists and stacked cards, so the GPU stays free for the field.
            </p>
          </div>
          <div className="rounded-panel p-6 hairline">
            <p className="mono-label">hairline</p>
            <p className="mt-3 text-body text-bone-2">Structure without surface. 8% bone.</p>
          </div>
          <div className="glass p-6 md:col-span-3">
            <p className="mono-label">skeleton (loading on glass)</p>
            <div className="mt-4 flex flex-col gap-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-24 w-full" />
            </div>
          </div>
        </div>
      </Section>

      <Section index="05" title="Components">
        <Kit />
      </Section>

      <Section index="06" title="Motion">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["micro", "140 ms", "hover, press, focus"],
            ["state", "380 ms", "expo-out, state changes"],
            ["sequence", "760 ms", "orchestrated, GSAP"],
            ["drawer", "420 ms", "sheets and drawers"],
          ].map(([n, d, use]) => (
            <div key={n} className="glass-flat group p-5">
              <p className="mono-label">{n}</p>
              <p className="mt-2 font-mono text-heading">{d}</p>
              <p className="mt-1 text-bone-2 text-ui">{use}</p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full w-1/4 rounded-full bg-signal transition-transform duration-[760ms] ease-out group-hover:translate-x-[300%]" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-line border-b py-14 md:grid-cols-[200px_1fr]">
      <div className="flex items-baseline gap-3 md:flex-col md:gap-1">
        <span className="font-mono text-[10px] text-bone-3">{index}</span>
        <h2 className="font-serif text-[28px] leading-none">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
