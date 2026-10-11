import { SEED_BRANDS } from "@/contracts";
import type { Db } from "../db/client";
import { youtubeShorts } from "../providers/youtube";
import { scoreOutliers } from "../research/metrics";
import { saveFixture } from "./record";

export async function smokeYoutube(db: Db) {
  const brand = SEED_BRANDS[0];
  const r = await youtubeShorts(
    { db, runId: "smoke_youtube", brand, demoEvidence: [], limit: 6 },
    ["dog separation anxiety"],
    "en",
  );
  scoreOutliers(r.items);
  const file = saveFixture("youtube", "smoke", { query: "dog separation anxiety", items: r.items });
  return {
    mode: r.mode,
    usd: r.usd,
    file,
    items: r.items.map((e) => ({
      title: e.title,
      views: e.metrics.views,
      followers: e.metrics.followers,
      outlier: e.metrics.outlierScore,
    })),
  };
}
