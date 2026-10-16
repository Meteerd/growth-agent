import fs from "node:fs";
import { zipSync } from "fflate";
import { handle } from "@/engine/http";
import { mustBrand } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { listAds } from "@/engine/studio/store";
import type { AdStatus } from "@/engine/studio/types";
import { urlToFile } from "@/engine/video/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csv = (v: string) => `"${v.replace(/"/g, '""')}"`;

/**
 * Everything ready to upload: one folder per ad (slides as PNG) and ads.csv with the Ads Manager fields per ad.
 * ?status=approved (default) | ready | all
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/export">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const status = new URL(req.url).searchParams.get("status") ?? "approved";
  const ads = (await listAds(d, { brandId: b.id, status: status === "all" ? undefined : (status as AdStatus) })).filter(
    (a) => a.body.slides.some((s) => s.png),
  );
  const files: Record<string, Uint8Array> = {};
  const rows = [
    [
      "ad",
      "format",
      "kind",
      "language",
      "aspect",
      "score",
      "primary_text",
      "headline",
      "description",
      "cta_button",
      "images",
    ].join(","),
  ];
  for (const [i, a] of ads.entries()) {
    const folder = `${String(i + 1).padStart(2, "0")}_${a.body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}`;
    const names: string[] = [];
    for (const [j, s] of a.body.slides.entries()) {
      const f = s.png ? urlToFile(s.png) : null;
      if (!f || !fs.existsSync(f)) continue;
      const name = `${folder}/${String(j + 1).padStart(2, "0")}.png`;
      files[name] = new Uint8Array(fs.readFileSync(f));
      names.push(name);
    }
    const c = a.body.copy;
    rows.push(
      [
        folder,
        a.format,
        a.kind,
        a.body.language,
        a.body.aspect,
        String(a.score ?? ""),
        c.primaryText,
        c.headline,
        c.description,
        c.cta,
        names.join(" "),
      ]
        .map((x) => csv(String(x)))
        .join(","),
    );
  }
  files["ads.csv"] = new TextEncoder().encode(`﻿${rows.join("\n")}\n`);
  files["README.txt"] = new TextEncoder().encode(
    `${b.name}: ${ads.length} ${status} ads from Rekampols Studio.\nOne folder per ad (carousel slides in order). ads.csv has the Ads Manager copy per ad.\nImages were made with AI: follow Meta's AI disclosure at upload.\n`,
  );
  const zip = zipSync(files, { level: 0 });
  return new Response(Buffer.from(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${b.slug}-${status}-ads.zip"`,
    },
  });
});
