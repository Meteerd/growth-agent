import type { ConnectionStatus } from "@/contracts";
import { cn } from "@/lib/client/cn";
import { Badge, CONNECTION_TONE, StatusDot } from "./Badge";

const LABEL: Record<ConnectionStatus, string> = { live: "Live", demo: "Demo", missing: "Missing", error: "Error" };

export function ProviderTile({
  label,
  usedFor,
  status,
  note,
  kind,
  children,
  className,
}: {
  label: string;
  usedFor: string;
  status: ConnectionStatus;
  note?: string;
  kind?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      data-status={status}
      className={cn(
        "relative flex flex-col gap-4 rounded-panel p-5 transition-shadow duration-300",
        status === "live" && "glass-flat shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(124_255_178/0.18)]",
        status === "demo" && "glass-flat",
        status === "missing" && "border border-line border-dashed bg-transparent",
        status === "error" && "glass-flat shadow-[var(--shadow-panel),inset_0_0_0_1px_rgb(255_92_122/0.3)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {kind && <p className="mono-label">{kind}</p>}
          <h3 className={cn("mt-1 font-medium text-body", status === "missing" ? "text-bone-2" : "text-bone")}>
            {label}
          </h3>
        </div>
        {status === "demo" ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-bone-3 border-dashed px-2.5 font-mono text-[10.5px] text-bone-2 uppercase tracking-[0.06em]">
            Demo
          </span>
        ) : (
          <Badge tone={CONNECTION_TONE[status]}>
            <StatusDot status={status === "live" ? "live" : status === "error" ? "fail" : "off"} />
            {LABEL[status]}
          </Badge>
        )}
      </header>
      <p className="text-bone-2 text-ui">{usedFor}</p>
      {note && <p className="font-mono text-[11px] text-bone-3">{note}</p>}
      {children}
    </article>
  );
}
