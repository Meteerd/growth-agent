"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { PHASES } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { PHASE_LABELS } from "@/lib/client/format";
import { useBrands } from "@/lib/client/queries";
import { startDemo } from "./PitchControls";

type Item = { id: string; label: string; hint: string; href: string; group: string; run?: () => void };

const RUN_SCREENS: [string, string][] = [
  ["", "Cockpit"],
  ["/consult", "Consultation"],
  ["/direction", "Direction"],
  ["/studio", "Studio"],
  ["/packs", "Packs"],
];

/** Cmd+K / Ctrl+K: jump to any brand, its latest run, a run screen or an app screen (BS2). */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const path = usePathname();
  const { data: brands } = useBrands();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [
      { id: "home", label: "Home", hint: "landing", href: "/", group: "Go to" },
      { id: "brands", label: "Portfolio", hint: "all brands", href: "/brands", group: "Go to" },
      { id: "new", label: "Add a brand", hint: "paste a URL", href: "/brands/new", group: "Go to" },
      { id: "settings", label: "Providers and spend", hint: "settings", href: "/settings", group: "Go to" },
      {
        id: "demo",
        label: "Play the 2-minute demo",
        hint: "presentation mode",
        href: "",
        group: "Pitch",
        run: startDemo,
      },
    ];
    const run = path.match(/^\/runs\/([^/]+)/)?.[1];
    if (run)
      for (const [suffix, label] of RUN_SCREENS)
        out.push({ id: `this${suffix}`, label, hint: run, href: `/runs/${run}${suffix}`, group: "This run" });
    for (const b of brands ?? []) {
      out.push({ id: `b-${b.slug}`, label: b.name, hint: "brand home", href: `/brands/${b.slug}`, group: "Brands" });
      out.push({
        id: `r-${b.slug}`,
        label: `${b.name} results`,
        hint: "results",
        href: `/brands/${b.slug}/results`,
        group: "Brands",
      });
      if (b.lastRun)
        out.push({
          id: `l-${b.slug}`,
          label: `${b.name}: latest run`,
          hint: `${PHASE_LABELS[b.lastRun.phase] ?? PHASES[0]} / ${b.lastRun.status.replace("_", " ")}`,
          href: `/runs/${b.lastRun.id}`,
          group: "Runs",
        });
    }
    const t = q.trim().toLowerCase();
    return t ? out.filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(t)) : out;
  }, [brands, path, q]);

  const go = (i?: Item) => {
    if (!i) return;
    setOpen(false);
    setQ("");
    if (i.run) i.run();
    else router.push(i.href);
  };

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setSel(0);
      }}
    >
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-[rgb(17_17_17/0.22)]" />
        <D.Content
          aria-describedby={undefined}
          className="dialog fixed top-[14vh] left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-panel bg-raised shadow-[var(--shadow-menu)]"
          data-testid="palette"
        >
          <D.Title className="sr-only">Jump to</D.Title>
          <input
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") go(items[sel]);
            }}
            placeholder="Jump to a brand, a run or a screen"
            aria-label="Jump to"
            className="h-12 w-full border-line border-b bg-transparent px-4 text-[15px] text-bone outline-none placeholder:text-bone-4"
          />
          <ul aria-label="Results" className="max-h-[50vh] overflow-y-auto py-1">
            {items.length === 0 && <li className="px-4 py-3 text-[13px] text-bone-3">Nothing matches.</li>}
            {items.map((i, n) => (
              <li key={i.id}>
                <button
                  aria-current={n === sel || undefined}
                  onMouseEnter={() => setSel(n)}
                  onClick={() => go(i)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left",
                    n === sel && "bg-raised-2",
                  )}
                >
                  <span className="text-[14px] text-bone">{i.label}</span>
                  <span className="truncate text-[12px] text-bone-3">
                    {i.group} / {i.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-line border-t px-4 py-2 text-[11.5px] text-bone-3">
            Arrows to move, Enter to open, Esc to close.
          </p>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
