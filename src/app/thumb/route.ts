import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local cache for third-party covers (evidence thumbnails): the browser only ever talks to localhost, and a cover seen
// once online still shows with the venue Wi-Fi down. Lives in data/ (git-ignored); never committed, never re-uploaded.
const DIR = path.resolve("data/thumbs");
const HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|tiktokcdn(-us|-eu)?\.com|ytimg\.com|spiral\.ad)$/i;
const MAX_BYTES = 4_000_000;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  let src: URL;
  try {
    src = new URL(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (src.protocol !== "https:" || !HOSTS.test(src.hostname)) return new Response(null, { status: 400 });

  const file = path.join(DIR, createHash("sha1").update(raw).digest("hex"));
  const ok = (body: Uint8Array, type: string) =>
    new Response(body as BodyInit, { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });
  try {
    const [body, type] = await Promise.all([fs.readFile(file), fs.readFile(`${file}.type`, "utf8")]);
    return ok(body, type);
  } catch {}
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
    const type = res.headers.get("content-type") ?? "";
    const body = new Uint8Array(await res.arrayBuffer());
    if (!res.ok || !type.startsWith("image/") || body.length > MAX_BYTES) throw new Error("not an image");
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file, body);
    await fs.writeFile(`${file}.type`, type);
    return ok(body, type);
  } catch {
    // 204, not 404: offline and never cached, the <img> falls back to its text card without a console error
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
}
