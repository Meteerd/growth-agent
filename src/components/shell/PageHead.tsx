import { cn } from "@/lib/client/cn";

/** Every app screen opens the same way: mono eyebrow, serif title, one plain sentence, actions on the right. */
export function PageHead({
  eyebrow,
  title,
  children,
  actions,
  className,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-6 pt-10 pb-8 md:flex-row md:items-end md:justify-between md:pt-14", className)}
    >
      <div className="min-w-0">
        <p className="rise mono-label">{eyebrow}</p>
        <h1
          className="rise mt-3 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1] tracking-[-0.012em]"
          style={{ animationDelay: "60ms" }}
        >
          {title}
        </h1>
        {children && (
          <div className="rise mt-4 max-w-2xl text-bone-2 text-body" style={{ animationDelay: "120ms" }}>
            {children}
          </div>
        )}
      </div>
      {actions && (
        <div className="rise flex shrink-0 flex-wrap items-center gap-2" style={{ animationDelay: "160ms" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-[1440px] px-4 pb-24 md:px-8", className)}>{children}</main>;
}
