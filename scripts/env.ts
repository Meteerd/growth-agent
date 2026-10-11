/** Load .env for CLI scripts (Next.js loads it itself). Never prints values. */
export function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env: defaults and demo mode
  }
}
