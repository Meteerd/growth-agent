import { z } from "zod";
import { handle, json, parseBody } from "@/engine/http";
import { listBrands } from "@/engine/repo";
import { getConfig } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { startJob } from "@/engine/studio/jobs";
import { listAds, listRefs } from "@/engine/studio/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const d = await sdb();
  const brands = await listBrands(d);
  return json(
    await Promise.all(
      brands.map(async (b) => {
        const [cfg, ads, refs] = await Promise.all([getConfig(d, b), listAds(d, { brandId: b.id }), listRefs(d, b.id)]);
        const best = ads
          .filter((a) => a.status !== "failed" && a.body.slides[0]?.png)
          .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];
        return {
          id: b.id,
          slug: b.slug,
          name: b.name,
          url: b.url,
          oneLiner: b.dossier.oneLiner,
          countries: b.countries,
          logo: cfg.logo,
          colors: cfg.colors,
          counts: { ads: ads.length, approved: ads.filter((a) => a.status === "approved").length, refs: refs.length },
          cover: best?.body.slides[0]?.png ?? null,
        };
      }),
    ),
  );
});

const Create = z.object({
  url: z.string().min(3),
  name: z.string().optional(),
  countries: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  autopilot: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  await sdb();
  const { autopilot, ...input } = await parseBody(req, Create);
  const job = await startJob(autopilot ? "autopilot" : "setup", null, input);
  return json({ jobId: job.id }, 202);
});
