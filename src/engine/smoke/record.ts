import fs from "node:fs";
import path from "node:path";

export const LIVE_FIXTURE_DIR = path.join(process.cwd(), "src/contracts/fixtures/live");

/** Strip anything that could carry a credential before writing a recorded response to the repo. */
export function scrub<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (k, val) => {
      if (/^(authorization|x-api-key|api[-_]?key|token|secret|x-manus-api-key)$/i.test(k)) return "[redacted]";
      if (
        typeof val === "string" &&
        /(sk-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{8,}|apify_api_[A-Za-z0-9]{8,})/.test(val)
      )
        return "[redacted]";
      return val;
    }),
  );
}

export function saveFixture(provider: string, name: string, data: unknown): string {
  const dir = path.join(LIVE_FIXTURE_DIR, provider);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(
    file,
    `${JSON.stringify(scrub({ recordedAt: new Date().toISOString(), ...(data as object) }), null, 2)}\n`,
  );
  return file;
}

export function loadFixture<T = unknown>(provider: string, name: string): T | null {
  const file = path.join(LIVE_FIXTURE_DIR, provider, `${name}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
