import { handle, json } from "@/engine/http";
import { getConfig, mustBrand } from "@/engine/studio/config";
import { FORMATS } from "@/engine/studio/formats";
import { sdb } from "@/engine/studio/http";
import { IMAGE_MODEL_INFO } from "@/engine/studio/images";
import { kvGet, listAds, listJobs, listRefs } from "@/engine/studio/store";
import type { Playbook } from "@/engine/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/studio/brands/[slug]">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const [config, playbook, ads, refs, jobs] = await Promise.all([
    getConfig(d, b),
    kvGet<Playbook>(d, `playbook:${b.id}`),
    listAds(d, { brandId: b.id }),
    listRefs(d, b.id),
    listJobs(d, { brandId: b.id, limit: 8 }),
  ]);
  return json({
    brand: b,
    config,
    playbook,
    counts: {
      ads: ads.length,
      ready: ads.filter((a) => a.status === "ready").length,
      approved: ads.filter((a) => a.status === "approved").length,
      refs: refs.length,
      analysed: refs.filter((r) => r.body.analysis).length,
    },
    jobs,
    imageModels: Object.entries(IMAGE_MODEL_INFO).map(([id, m]) => ({ id, label: m.label, usd: m.usd, note: m.note })),
    formats: FORMATS.map((f) => ({ id: f.id, name: f.name, stage: f.stage })),
  });
});
