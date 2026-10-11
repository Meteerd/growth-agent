import { EventEmitter } from "node:events";

/** In-process notifications: "a new RunEvent exists for run X". SSE streams re-read the DB on each ping. */
const g = globalThis as unknown as { __nexusBus?: EventEmitter };
if (!g.__nexusBus) {
  g.__nexusBus = new EventEmitter();
  g.__nexusBus.setMaxListeners(0);
}
export const bus = g.__nexusBus;

export const runChannel = (runId: string) => `run:${runId}`;
