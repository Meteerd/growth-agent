import { db, handle } from "@/engine/http";
import { packZip } from "@/engine/services/packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/packs/[id]/download">) => {
  const { id } = await ctx.params;
  const z = await packZip(await db(), id);
  return new Response(new Blob([z.data as BlobPart]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${z.name}"`,
      "Content-Length": String(z.data.byteLength),
      "X-Pack-Files": z.files.join(","),
    },
  });
});
