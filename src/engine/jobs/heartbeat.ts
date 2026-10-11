import fs from "node:fs";
import path from "node:path";

/**
 * Cross-process liveness for runs: whichever process drives a run touches data/heartbeats/<runId> every 15 s.
 * A run is only resumed after a restart when its heartbeat is missing or older than 60 s.
 */
const dir = () => path.resolve(process.env.HEARTBEAT_DIR || "data/heartbeats");

export function startHeartbeat(runId: string): () => void {
  fs.mkdirSync(dir(), { recursive: true });
  const f = path.join(dir(), runId);
  const touch = () => {
    try {
      fs.writeFileSync(f, String(process.pid));
    } catch {}
  };
  touch();
  const t = setInterval(touch, 15_000);
  t.unref?.();
  return () => {
    clearInterval(t);
    try {
      fs.unlinkSync(f);
    } catch {}
  };
}

/** Milliseconds since the run's heartbeat, or Infinity when there is none. */
export function heartbeatAge(runId: string): number {
  try {
    return Date.now() - fs.statSync(path.join(dir(), runId)).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
