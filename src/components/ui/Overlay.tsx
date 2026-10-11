"use client";

import { Dialog as D, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/client/cn";

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-[rgb(17_17_17/0.28)]" />
        <D.Content
          className={cn(
            "dialog glass -translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-[min(92vw,520px)] p-6 shadow-[var(--shadow-panel-strong)]",
            "bg-raised",
            className,
          )}
        >
          <D.Title className="font-display text-[28px] leading-tight">{title}</D.Title>
          {description && <D.Description className="mt-2 text-bone-2 text-ui">{description}</D.Description>}
          <div className="mt-5">{children}</div>
          <D.Close className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-bone-3 transition-colors hover:bg-glass hover:text-bone">
            <span className="sr-only">Close</span>
            <Cross />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Right-hand drawer (evidence, chat). Uses the drawer ease. */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  label,
  children,
  className,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-[rgb(17_17_17/0.22)]" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "sheet fixed inset-y-2 right-2 z-50 flex w-[min(calc(100vw-16px),460px)] flex-col overflow-hidden rounded-panel",
            "bg-raised shadow-[var(--shadow-panel-strong)]",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-line border-b px-5 py-4">
            <div>
              {label && <p className="mono-label">{label}</p>}
              <D.Title className="mt-1 font-display text-[26px] leading-tight">{title}</D.Title>
            </div>
            <D.Close className="grid size-8 place-items-center rounded-full text-bone-3 transition-colors hover:bg-glass hover:text-bone">
              <span className="sr-only">Close</span>
              <Cross />
            </D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <T.Provider delayDuration={250} skipDelayDuration={100}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={8}
            className="tooltip z-50 max-w-64 rounded-[8px] bg-raised px-2.5 py-1.5 font-mono text-[11px] text-bone leading-snug shadow-[var(--shadow-panel-strong)]"
          >
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

export function Cross() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
