import fs from "node:fs";
import path from "node:path";
import { DEMO_RUNS } from "@/contracts";
import type { Db } from "./db/client";
import { nowIso } from "./ids";
import { getAsset, getBrand, getConcept, upsertAsset, upsertConcept } from "./repo";
import { fileToUrl, urlToFile } from "./video/files";
import { demoKeyframe, writeAsset } from "./video/keyframes";
import { renderAd } from "./video/render";

/**
 * Seeded demo runs reference demo keyframes and review videos. On a fresh clone they do not exist yet, so
 * this builds them locally (zero cost: brand reference images + ffmpeg) and links them to the concepts.
 * Idempotent: files that exist are kept.
 */
export async function prepareDemoMedia(db: Db): Promise<number> {
  let made = 0;
  for (const bundle of Object.values(DEMO_RUNS)) {
    const brand = await getBrand(db, bundle.brand.id);
    const remake = bundle.concepts.find((c) => c.blueprintId);
    if (!brand || !remake) continue;
    const c = await getConcept(db, remake.id);
    if (!c) continue;
    // keyframes
    const shots = [...c.shots];
    for (const s of c.shots) {
      const id = `asset_${c.id}_kf_${s.idx}`;
      const rel = path.join("demo", brand.slug, `${c.id}_kf_${s.idx}.png`);
      const file = path.resolve(process.env.ASSETS_DIR || "data/assets", rel);
      if (!fs.existsSync(file)) {
        writeAsset(rel, await demoKeyframe(brand, s));
        made++;
      }
      if (!(await getAsset(db, id))) {
        await upsertAsset(db, {
          id,
          brandId: brand.id,
          conceptId: c.id,
          kind: "keyframe",
          url: fileToUrl(file),
          provider: "local",
          model: "local-svg",
          costUsd: 0,
          width: 1080,
          height: 1920,
          demo: true,
          createdAt: nowIso(),
          shotIdx: s.idx,
        });
      }
      shots[s.idx] = { ...s, keyframeAssetId: s.keyframeAssetId ?? id };
    }
    if (shots.some((s, i) => s.keyframeAssetId !== c.shots[i].keyframeAssetId))
      await upsertConcept(db, { ...c, shots });
    // the review videos the fixtures point at (r1, r2)
    for (const a of bundle.assets.filter((x) => x.kind === "video")) {
      const out = urlToFile(a.url);
      if (!out || fs.existsSync(out)) continue;
      const frames = [];
      for (const s of shots)
        frames.push({
          src: (await getAsset(db, s.keyframeAssetId!))!.url,
          durationSec: s.durationSec,
          text: s.onScreenText,
        });
      await renderAd(
        {
          shots: frames,
          brandName: brand.name,
          colors: brand.dossier.visual.colors,
          logoSrc: brand.dossier.visual.logoUrl,
          cta: c.cta,
          badge: "Demo render",
          endCardSec: 2,
        },
        out,
      );
      made++;
    }
  }
  return made;
}
