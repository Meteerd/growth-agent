import fs from "node:fs";
import { zipSync } from "fflate";
import { handle, notFound } from "@/engine/http";
import { sdb } from "@/engine/studio/http";
import { getAd } from "@/engine/studio/store";
import { urlToFile } from "@/engine/video/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A zip with the slides (PNG) and copy.txt (everything to paste into Ads Manager). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/studio/ads/[id]/download">) => {
  const { id } = await ctx.params;
  const a = await getAd(await sdb(), id);
  if (!a) throw notFound("Ad");
  const files: Record<string, Uint8Array> = {};
  for (const [i, s] of a.body.slides.entries()) {
    const f = s.png ? urlToFile(s.png) : null;
    if (f && fs.existsSync(f)) files[`${String(i + 1).padStart(2, "0")}.png`] = new Uint8Array(fs.readFileSync(f));
  }
  const c = a.body.copy;
  const txt = [
    `${a.body.title} (${a.format}, ${a.kind}, ${a.body.aspect}, ${a.body.language})`,
    "",
    "PRIMARY TEXT",
    c.primaryText,
    "",
    `HEADLINE: ${c.headline}`,
    `DESCRIPTION: ${c.description}`,
    `CTA BUTTON: ${c.cta}`,
    "",
    `Angle: ${a.body.angle}`,
    `Persona: ${a.body.persona}`,
    `Why: ${a.body.rationale}`,
    a.body.compliance
      ? `Compliance: ${a.body.compliance.status}${a.body.compliance.findings.length ? ` (${a.body.compliance.findings.map((f) => `${f.ruleId}: ${f.message}`).join("; ")})` : ""}`
      : "",
    "Images made with AI: follow Meta's AI disclosure at upload.",
  ].join("\n");
  files["copy.txt"] = new TextEncoder().encode(txt);
  const zip = zipSync(files, { level: 0 });
  const name = `${
    a.body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40) || a.id
  }.zip`;
  return new Response(Buffer.from(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"` },
  });
});
