import { CreateBrandRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { startRun } from "@/engine/jobs/runner";
import { listBrandSummaries } from "@/engine/repo";
import { createBrand } from "@/engine/services/brands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => json(await listBrandSummaries(await db())));

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, CreateBrandRequest);
  const d = await db();
  const out = await createBrand(d, body);
  startRun(out.run.id);
  return json(out, 201);
});
