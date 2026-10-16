import { handle, json } from "@/engine/http";
import { listSpend, spentByProvider } from "@/engine/repo";
import { sdb } from "@/engine/studio/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const d = await sdb();
  const caps = Object.fromEntries(
    ["anthropic", "openai", "fal", "apify", "firecrawl"].map((p) => [
      p,
      Number(process.env[`BUDGET_USD_${p.toUpperCase()}`] ?? 0) || null,
    ]),
  );
  const recent = (await listSpend(d)).slice(-40).reverse();
  return json({ spent: await spentByProvider(d), caps, recent });
});
