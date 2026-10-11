"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "nexus-present";

/** True when presentation mode is on (set by ?present=1, kept for the session, cleared by ?present=0). */
export function isPresenting() {
  return typeof document !== "undefined" && document.documentElement.dataset.present === "1";
}

/**
 * Presentation mode for the pitch (BS1): `?present=1` hides dev chrome (data-mode chip, stream status, lab links),
 * enlarges everything for a projector, and shows replay speed controls in the cockpit. `?present=0` turns it off.
 */
export function PresentMode() {
  const path = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the flag on every navigation
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("present");
    try {
      if (q === "1") sessionStorage.setItem(KEY, "1");
      if (q === "0") sessionStorage.removeItem(KEY);
    } catch {}
    let on = q === "1";
    try {
      on ||= q !== "0" && sessionStorage.getItem(KEY) === "1";
    } catch {}
    if (on) document.documentElement.dataset.present = "1";
    else delete document.documentElement.dataset.present;
    window.dispatchEvent(new Event("nexus-present"));
  }, [path]);
  return null;
}
