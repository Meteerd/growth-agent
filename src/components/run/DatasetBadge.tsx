import { Badge, DemoBadge, StatusDot } from "@/components/ui/Badge";
import type { Run } from "@/contracts";
import { timeAgo } from "@/lib/client/format";

/** Where a run's data came from: demo fixtures, a recorded live pass, or live calls now. */
export function DatasetBadge({ run }: { run?: Pick<Run, "demo" | "dataset" | "capturedAt"> }) {
  if (!run) return null;
  if (run.dataset === "live_recorded")
    return (
      <Badge
        tone="pass"
        title={run.capturedAt ? `Captured ${new Date(run.capturedAt).toLocaleString()}` : undefined}
        data-testid="dataset-badge"
      >
        <StatusDot status="live" />
        Live data{run.capturedAt ? `, captured ${timeAgo(run.capturedAt)}` : ""}
      </Badge>
    );
  if (run.dataset === "live" || !run.demo)
    return (
      <Badge tone="signal" data-testid="dataset-badge">
        <StatusDot status="live" />
        Live
      </Badge>
    );
  return <DemoBadge />;
}
