"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** A slim bar at the top while the next screen loads: starts on an internal link click, completes on arrival. */
export function RouteProgress() {
  const path = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname && !url.pathname.startsWith("/api/"))
        setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the new path is the arrival signal
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const id = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 350);
    return () => clearTimeout(id);
  }, [path]);

  if (state === "idle") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-signal"
      style={{
        transform: `scaleX(${state === "done" ? 1 : 0.7})`,
        opacity: state === "done" ? 0 : 1,
        transition:
          state === "done"
            ? "transform 150ms ease-out, opacity 250ms ease 120ms"
            : "transform 2.5s cubic-bezier(0.1,0.7,0.3,1)",
      }}
    />
  );
}
