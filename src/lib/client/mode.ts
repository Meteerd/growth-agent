/** mock = in-browser fixtures (always available); live = Lane A's /api routes (default for the demo). */
export const DATA_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "live";
