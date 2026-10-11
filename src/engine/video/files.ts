import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

export const assetsDir = () => path.resolve(process.env.ASSETS_DIR || "data/assets");
export const brandAssetsDir = () => path.resolve("assets/brands");

/** Map an /api/assets/... URL to a local file path (brands/ -> committed brand assets). */
export function urlToFile(url: string): string | null {
  const m = url.match(/^\/api\/assets\/(.+)$/);
  if (!m) return null;
  const rel = decodeURIComponent(m[1]);
  const [root, sub] = rel.startsWith("brands/") ? [brandAssetsDir(), rel.slice(7)] : [assetsDir(), rel];
  const f = path.resolve(root, sub);
  return f.startsWith(root + path.sep) ? f : null;
}

export function fileToUrl(file: string): string {
  const rel = path.relative(assetsDir(), path.resolve(file));
  if (rel.startsWith("..")) throw new Error(`not under ASSETS_DIR: ${file}`);
  return `/api/assets/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** Tiny static server for renders: serves /api/assets/... from disk (Remotion needs http URLs). */
export async function withAssetServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const server = http.createServer((req, res) => {
    const file = urlToFile((req.url ?? "").split("?")[0]);
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "access-control-allow-origin": "*",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    return await fn(base);
  } finally {
    server.close();
  }
}
