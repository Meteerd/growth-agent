import { cn } from "@/lib/client/cn";

/** Every empty state has a sentence and an action. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-panel border border-line border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <span aria-hidden className="relative grid size-12 place-items-center">
        <span className="absolute inset-0 rounded-full shadow[inset_0_0_0_1px_var(--color-line-strong)]" />
        <span className="absolute inset-3 rounded-full shadow[inset_0_0_0_1px_var(--color-line)]" />
        <span className="size-1.5 rounded-full bg-bone-3" />
      </span>
      <p className="font-display text-[26px] leading-tight">{title}</p>
      {children && <div className="max-w-md text-bone-2 text-ui">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Could not load this",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-panel bg-[rgb(192_53_43/0.06)] p-6 shadow[inset_0_0_0_1px_rgb(192_53_43/0.25)]",
        className,
      )}
    >
      <p className="font-medium text-bone text-body">{title}</p>
      {message && <p className="font-mono text-[11px] text-bone-2">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-chip px-3 py-1.5 font-mono text-[11px] text-bone shadow[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-glass"
        >
          Try again
        </button>
      )}
    </div>
  );
}
