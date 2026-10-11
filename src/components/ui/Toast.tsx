"use client";

import { Toast as T } from "radix-ui";
import { create } from "zustand";
import { cn } from "@/lib/client/cn";

type Item = { id: number; title: string; body?: string; tone?: "neutral" | "pass" | "fail" };
const useToasts = create<{ items: Item[]; push: (t: Omit<Item, "id">) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: Date.now() + Math.random() }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = (t: Omit<Item, "id">) => useToasts.getState().push(t);

export function Toaster() {
  const { items, drop } = useToasts();
  return (
    <T.Provider swipeDirection="right" duration={4200}>
      {items.map((t) => (
        <T.Root
          key={t.id}
          onOpenChange={(o) => !o && drop(t.id)}
          className="toast glass flex items-start gap-3 bg-[linear-gradient(180deg,rgb(22_25_33/0.94),rgb(12_14_19/0.94))] p-4 pr-5"
        >
          <span
            className={cn(
              "mt-1.5 size-1.5 shrink-0 rounded-full",
              t.tone === "pass" ? "bg-pass" : t.tone === "fail" ? "bg-fail" : "bg-signal",
            )}
          />
          <div>
            <T.Title className="text-bone text-ui">{t.title}</T.Title>
            {t.body && <T.Description className="mt-0.5 text-[12px] text-bone-2">{t.body}</T.Description>}
          </div>
        </T.Root>
      ))}
      <T.Viewport className="fixed right-4 bottom-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2 outline-none" />
    </T.Provider>
  );
}
