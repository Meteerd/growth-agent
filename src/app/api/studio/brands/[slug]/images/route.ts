import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { HttpError, handle, json } from "@/engine/http";
import { newId } from "@/engine/ids";
import { getConfig, mustBrand, setConfig } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { studioDir } from "@/engine/studio/setup";
import { fileToUrl } from "@/engine/video/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload real brand images (multipart field "file", optional "note", "role" = image|logo|logoOnDark|product). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/images">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const form = await req.formData();
  const role = String(form.get("role") ?? "image");
  const note = String(form.get("note") ?? "");
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!files.length) throw new HttpError(400, "no_file", "Attach at least one image as 'file'");
  const dir = studioDir("brands", b.slug, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const urls: string[] = [];
  for (const f of files.slice(0, 20)) {
    if (f.size > 25_000_000) continue;
    const out = path.join(dir, `${newId("up")}.${role === "image" || role === "product" ? "webp" : "png"}`);
    const img = sharp(Buffer.from(await f.arrayBuffer()), { density: 300 })
      .rotate()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true });
    await (out.endsWith(".png") ? img.png() : img.webp({ quality: 90 })).toFile(out);
    urls.push(fileToUrl(out));
  }
  const cfg = await getConfig(d, b);
  const next = await setConfig(
    d,
    b,
    role === "logo"
      ? { logo: urls[0] }
      : role === "logoOnDark"
        ? { logoOnDark: urls[0] }
        : role === "product"
          ? { productShot: urls[0] }
          : {
              brandImages: [
                ...urls.map((url) => ({ url, note: note || "uploaded by the operator" })),
                ...cfg.brandImages,
              ].slice(0, 40),
            },
  );
  return json({ urls, config: next });
});

/** Remove a brand image from the kit: body {url}. */
export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/images">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const { url } = (await req.json()) as { url: string };
  const cfg = await getConfig(d, b);
  return json(await setConfig(d, b, { brandImages: cfg.brandImages.filter((x) => x.url !== url) }));
});
