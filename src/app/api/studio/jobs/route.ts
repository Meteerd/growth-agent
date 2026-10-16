import { handle, json } from "@/engine/http";
import { mustBrand } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { listJobs } from "@/engine/studio/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const d = await sdb();
  const brand = new URL(req.url).searchParams.get("brand");
  const b = brand ? await mustBrand(d, brand) : null;
  return json(await listJobs(d, { brandId: b?.id, limit: 30 }));
});
