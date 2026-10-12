/** mock = in-browser fixtures (always available); live = Lane A's /api routes (default for the demo). The public
 * showcase (`NEXT_PUBLIC_DATA_MODE=showcase`) reads the same /api routes. */
export const DATA_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "live";

/** The public showcase build (B21): recorded data only; the API refuses every change (src/proxy.ts). */
export const READ_ONLY = process.env.NEXT_PUBLIC_DATA_MODE === "showcase";
