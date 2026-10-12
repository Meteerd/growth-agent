import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Analysis frames of third-party winners exist only on the machine that watched them (never committed). Elsewhere the
// shot card shows its description; answering 204 instead of 404 keeps the console clean on every machine.
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const root = path.resolve(process.env.ASSETS_DIR || "data/assets", "frames");
  const file = path.resolve(root, (await ctx.params).path.join("/"));
  if (!file.startsWith(root + path.sep) || !/\.(jpe?g|png|webp)$/i.test(file))
    return new Response(null, { status: 400 });
  try {
    const body = await fs.readFile(file);
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
  } catch {
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
}
