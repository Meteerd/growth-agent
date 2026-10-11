import { CHANNEL_LABELS, type Channel, type Evidence } from "@/contracts";
import { formatCount } from "@/lib/client/format";

/** The one number that says why a piece of evidence counts: outlier multiple, else views, else days running. */
export function evidenceStat({ metrics: m }: Pick<Evidence, "metrics">): string | undefined {
  if (m.outlierScore != null) return `${m.outlierScore.toFixed(m.outlierScore >= 10 ? 0 : 1)}x`;
  if (m.views != null) return formatCount(m.views, "compact");
  if (m.daysRunning != null) return `${m.daysRunning}d`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** New order with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const t = Math.min(Math.max(to, 0), out.length - 1);
  const [item] = out.splice(from, 1);
  out.splice(t, 0, item);
  return out;
}

/** First sentence of a rationale, for the one-line "why" in the table. */
export function firstSentence(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
}

/** The mock and engine prefix operator drops with the channel label; the row already shows it. */
export function notNowReason(channel: Channel, reason: string) {
  const prefix = `${CHANNEL_LABELS[channel]}: `;
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason;
}
