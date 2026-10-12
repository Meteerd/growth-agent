import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The flagship renders for the landing, straight from docs/renders (Lane A updates them there), with range requests so
// video seeks and Safari playback work. Only plain file names; nothing outside docs/renders.
const ROOT = path.resolve("docs/renders");
const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webm": "video/webm" };

/** A pull stream: reads only as fast as the client takes it and stops cleanly when the video element cancels. */
function body(file: string, range?: { start: number; end: number }) {
  const rs = createReadStream(file, range);
  const it = rs[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const { value, done } = await it.next();
        if (done) c.close();
        else c.enqueue(value);
      } catch (e) {
        c.error(e);
      }
    },
    cancel() {
      rs.destroy();
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const type = TYPES[path.extname(name)];
  if (!type || name.includes("/") || name.startsWith(".")) return new Response(null, { status: 404 });
  const file = path.join(ROOT, name);
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) return new Response(null, { status: 404 });
  const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "public, max-age=300" };
  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) {
    return new Response(body(file), { headers: { ...headers, "content-length": String(stat.size) } });
  }
  const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
  if (start > end || start >= stat.size)
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
  return new Response(body(file, { start, end }), {
    status: 206,
    headers: {
      ...headers,
      "content-length": String(end - start + 1),
      "content-range": `bytes ${start}-${end}/${stat.size}`,
    },
  });
}
