import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { errorResponse, handle } from "@/engine/http";
import { extractFrame } from "@/engine/media/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

/** `brands/...` serves the committed brand assets; everything else is served from ASSETS_DIR (data/assets). */
function resolveFile(parts: string[]): string | null {
  const rel = parts.join("/");
  const [root, sub] =
    parts[0] === "brands"
      ? [path.resolve("assets/brands"), parts.slice(1).join("/")]
      : [path.resolve(process.env.ASSETS_DIR || "data/assets"), rel];
  const file = path.resolve(root, sub);
  if (!file.startsWith(root + path.sep)) return null;
  return file;
}

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/assets/[...path]">) => {
  const { path: parts } = await ctx.params;
  const file = resolveFile(parts);
  // posters are built on demand from their video (they are not committed)
  if (
    file?.endsWith(".mp4.poster.jpg") &&
    !fs.existsSync(file) &&
    fs.existsSync(file.slice(0, -".poster.jpg".length))
  ) {
    await extractFrame(file.slice(0, -".poster.jpg".length), 1.2, file, 720).catch(() => undefined);
  }
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return errorResponse(404, "not_found", "Asset not found");
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end)
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
});
