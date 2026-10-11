"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FieldCanvas = dynamic(() => import("./FieldCanvas"), { ssr: false });

// Static gradient renders first (SSR); the WebGL field fades in after the page is idle.
// Reduced motion or no WebGL: the static gradient stays.
export function Field() {
  const [mount, setMount] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (new URLSearchParams(window.location.search).get("field") === "0") return;
    if (!document.createElement("canvas").getContext("webgl2")) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const id = idle(() => setMount(true), { timeout: 1500 });
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, []);
  return (
    <>
      <div className="field-static absolute inset-0" />
      {mount && <FieldCanvas />}
    </>
  );
}
