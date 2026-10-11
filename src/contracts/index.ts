/**
 * @/contracts: the single source of truth for every shape shared by the engine (Lane A) and the cockpit (Lane B).
 * Pure TypeScript + Zod, safe to import from client components.
 */
export const CONTRACTS_VERSION = "1.1.0";

export * from "./api";
export * from "./entities";
export * from "./enums";
export * from "./fixtures";
export * from "./providers";
