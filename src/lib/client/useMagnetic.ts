"use client";

import { useRef } from "react";

// v2: motion is functional only, so the v1 magnetic pull is gone; the hook stays so callers keep their ref.
export function useMagnetic<T extends HTMLElement>(_strength = 0, _max = 0) {
  return useRef<T>(null);
}
