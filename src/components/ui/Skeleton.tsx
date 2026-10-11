import { cn } from "@/lib/client/cn";

/** Glass shimmer, never a spinner. */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...rest} />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      className={cn("glass-flat flex flex-col gap-3 p-5", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-3/4" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  );
}
