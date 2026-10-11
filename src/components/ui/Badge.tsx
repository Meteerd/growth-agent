import type { ComplianceStatus, ConnectionStatus, RunStatus } from "@/contracts";
import { cn } from "@/lib/client/cn";

type Tone = "neutral" | "signal" | "pass" | "warn" | "fail" | "violet" | "cyan";
const TONE: Record<Tone, string> = {
  neutral: "text-bone-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
  signal: "text-signal bg-signal-dim shadow-[inset_0_0_0_1px_rgb(212_255_58/0.3)]",
  pass: "text-pass bg-[rgb(124_255_178/0.08)] shadow-[inset_0_0_0_1px_rgb(124_255_178/0.28)]",
  warn: "text-warn bg-[rgb(255_200_92/0.08)] shadow-[inset_0_0_0_1px_rgb(255_200_92/0.3)]",
  fail: "text-fail bg-[rgb(255_92_122/0.08)] shadow-[inset_0_0_0_1px_rgb(255_92_122/0.32)]",
  violet: "text-[#a99bff] bg-[rgb(91_60_255/0.12)] shadow-[inset_0_0_0_1px_rgb(91_60_255/0.4)]",
  cyan: "text-cyan bg-[rgb(60_224_255/0.08)] shadow-[inset_0_0_0_1px_rgb(60_224_255/0.3)]",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
  ...rest
}: { tone?: Tone; dot?: boolean } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em]",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Shown wherever data is demo fixtures. Dashed bone outline, never confused with live. */
export function DemoBadge({ className, label = "Demo data" }: { className?: string; label?: string }) {
  return (
    <span
      title="Deterministic demo fixtures, not live data"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border border-bone-3 border-dashed px-2.5 font-mono text-[10.5px] text-bone-2 uppercase tracking-[0.06em]",
        className,
      )}
    >
      {label}
    </span>
  );
}

const COMPLIANCE: Record<ComplianceStatus, [Tone, string]> = {
  pending: ["neutral", "Checking"],
  pass: ["pass", "Compliant"],
  warn: ["warn", "Review"],
  fail: ["fail", "Blocked"],
};
export function ComplianceBadge({ status, className }: { status: ComplianceStatus; className?: string }) {
  const [tone, label] = COMPLIANCE[status];
  return (
    <Badge tone={tone} className={className} title={`Compliance: ${status}`}>
      <ShieldGlyph />
      {label}
    </Badge>
  );
}

const RUN: Record<RunStatus, [Tone, string]> = {
  queued: ["neutral", "Queued"],
  running: ["signal", "Running"],
  waiting_input: ["warn", "Needs you"],
  done: ["pass", "Done"],
  failed: ["fail", "Failed"],
  cancelled: ["neutral", "Cancelled"],
};
export function RunStatusBadge({ status }: { status: RunStatus }) {
  const [tone, label] = RUN[status];
  return (
    <Badge tone={tone}>
      <StatusDot status={status === "running" ? "live" : status === "waiting_input" ? "warn" : "idle"} />
      {label}
    </Badge>
  );
}

export const CONNECTION_TONE: Record<ConnectionStatus, Tone> = {
  live: "pass",
  demo: "neutral",
  missing: "neutral",
  error: "fail",
};

type Dot = "live" | "warn" | "fail" | "idle" | "off";
const DOT: Record<Dot, string> = {
  live: "bg-signal animate-pulse-signal",
  warn: "bg-warn",
  fail: "bg-fail",
  idle: "bg-bone-3",
  off: "bg-transparent shadow-[inset_0_0_0_1px_var(--color-bone-3)]",
};
export function StatusDot({ status, className }: { status: Dot; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[status], className)} />;
}

export function MonoLabel({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("mono-label", className)} {...rest} />;
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
      <path
        d="M6 1.2 10 2.7v3.1c0 2.3-1.7 4.1-4 5-2.3-.9-4-2.7-4-5V2.7L6 1.2Z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}
