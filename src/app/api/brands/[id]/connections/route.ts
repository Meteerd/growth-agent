import { type Connection, CreateConnectionRequest } from "@/contracts";
import { db, handle, json, notFound, parseBody } from "@/engine/http";
import { keyPresent } from "@/engine/providers/env";
import { getBrand, listConnections, upsertConnection } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/brands/[id]/connections">) => {
  const { id } = await ctx.params;
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  return json(await listConnections(d, brand.id));
});

/** Connect a provider for this brand. Only non-secret ids go in config; keys stay in .env. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/brands/[id]/connections">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, CreateConnectionRequest);
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  const present = keyPresent(body.provider);
  const conn: Connection = {
    id: `conn_${brand.slug}_${body.provider}`,
    brandId: brand.id,
    provider: body.provider,
    status: present ? "live" : "demo",
    config: body.config ?? {},
    lastSyncAt: new Date().toISOString(),
    summary: present ? "Key present in .env; reads use this account" : "No key in .env: demo data (labelled)",
  };
  await upsertConnection(d, conn);
  return json(conn, 201);
});
