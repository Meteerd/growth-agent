// Back layers shared by every screen: (field shader slot) < measurement grid with ruler. Grain sits above content (Grain).
const COLS = Array.from({ length: 14 }, (_, i) => i * 160);
const ROWS = Array.from({ length: 8 }, (_, i) => i * 160);

export function Backdrop({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#11131a_0%,var(--color-ink)_60%)]" />
      {children}
      <div className="measure-grid" />
      <div className="absolute inset-x-0 top-0 hidden h-6 md:block">
        {COLS.map((x) => (
          <span key={x} className="absolute top-2 font-mono text-[9px] text-bone-4" style={{ left: x + 4 }}>
            {String(x).padStart(4, "0")}
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 hidden w-6 md:block">
        {ROWS.slice(1).map((y) => (
          <span
            key={y}
            className="absolute left-1.5 origin-left -rotate-90 font-mono text-[9px] text-bone-4"
            style={{ top: y + 28 }}
          >
            {String(y).padStart(4, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Grain() {
  return <div aria-hidden className="grain" />;
}
