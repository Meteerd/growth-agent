"use client";

import { useEffect } from "react";
import { create } from "zustand";

// UI state for the background field: pages set a target, the shader eases toward it.
// activity 0..1 (idle 0.15, running 0.6, waiting 0.35), vortex 0..1 (landing submit transition).
export type FieldAccent = "signal" | "cyan" | "violet";

type FieldState = {
  activity: number;
  accent: FieldAccent;
  vortex: number;
  set: (patch: Partial<Pick<FieldState, "activity" | "accent" | "vortex">>) => void;
};

export const useField = create<FieldState>((set) => ({
  activity: 0.15,
  accent: "signal",
  vortex: 0,
  set: (patch) => set(patch),
}));

export const ACCENT_RGB: Record<FieldAccent, [number, number, number]> = {
  signal: [0.831, 1, 0.227],
  cyan: [0.235, 0.878, 1],
  violet: [0.357, 0.235, 1],
};

// Exposed for Playwright and presentation mode (BS1) to drive the field without UI.
if (typeof window !== "undefined") (window as unknown as { __nexusField: typeof useField }).__nexusField = useField;

/** Pages declare how alive the field should be; it eases there. Resets vortex so arrivals settle the swirl. */
export function useFieldActivity(activity: number, accent: FieldAccent = "signal") {
  useEffect(() => {
    useField.getState().set({ activity, accent, vortex: 0 });
  }, [activity, accent]);
}
