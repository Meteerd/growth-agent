"use client";

import { useState } from "react";
import type { Brand } from "@/contracts";
import { logoOnDark } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";

/** Brand logo on a small glass tile; falls back to a serif monogram when there is no logo or it fails to load. */
export function BrandMark({
  brand,
  size = 40,
  className,
}: {
  brand: Pick<Brand, "slug" | "name" | "dossier">;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = logoOnDark(brand);
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-bone/5 shadow-[inset_0_0_0_1px_var(--color-line)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && !broken ? (
        // biome-ignore lint/performance/noImgElement: brand marks come from the engine asset route
        <img src={src} alt="" className="h-full w-full object-contain p-[14%]" onError={() => setBroken(true)} />
      ) : (
        <span className="font-display text-bone" style={{ fontSize: size * 0.5 }}>
          {brand.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
