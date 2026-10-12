"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import type { PublishPack } from "@/contracts";
import recorded from "@/contracts/fixtures/live/manus/landing_status.json";
import { ApiRequestError, getClient } from "@/lib/client/api";
import MANUS from "@/lib/client/manus-tasks.json";
import { qk } from "@/lib/client/queries";

// the recorded real Manus landing task (Hound, unpublished) stands in on Hound's TikTok pack until one is built for it
const RECORDED_BRAND = "brand_hound";

/** Manus builds a matching landing page for the pack. We link to the Manus task; nothing is published by us. */
export function LandingAction({ pack, runId }: { pack: PublishPack; runId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string>();
  const url = pack.landingUrl;
  const task = (MANUS.landings as Record<string, { taskUrl: string; state: string; title?: string }>)[pack.id];
  const landing =
    url && /^https?:\/\//.test(url)
      ? { url, title: task?.title, earlier: false, building: false }
      : task
        ? { url: task.taskUrl, title: task.title, earlier: false, building: task.state === "running" && !task.title }
        : pack.brandId === RECORDED_BRAND && pack.platform === "tiktok"
          ? {
              url: recorded.taskUrl,
              title: recorded.website.title,
              earlier: pack.id !== recorded.packId,
              building: false,
            }
          : undefined;
  if (landing)
    return (
      <div className="flex flex-col gap-1 rounded-card border border-line bg-raised-2 p-3" data-testid="pack-landing">
        <p className="mono-label">Landing page / built by Manus</p>
        {landing.title && <p className="font-medium text-bone text-ui">{landing.title.replace(" \u2014 ", ": ")}</p>}
        <p className="text-[12px] text-bone-2 leading-snug">
          {landing.building
            ? "Manus is building a matching landing page in its own workspace"
            : "Manus built a matching landing page in its own workspace"}
          {landing.earlier ? " for an earlier Hound pack on the same alone-time topic" : ""}. It stays unpublished:
          Nexus never publishes it.
        </p>
        <a
          href={landing.url}
          target="_blank"
          rel="noreferrer"
          className="self-start text-[12.5px] text-bone underline decoration-line-strong underline-offset-4 hover:decoration-bone"
        >
          Open the Manus task
        </a>
      </div>
    );
  if (unavailable)
    return (
      <p className="text-[12px] text-bone-3" data-testid="pack-landing-off">
        {unavailable}
      </p>
    );
  return (
    <button
      disabled={busy}
      data-testid="pack-landing-build"
      onClick={async () => {
        setBusy(true);
        try {
          await getClient().buildLanding(pack.id);
          await qc.invalidateQueries({ queryKey: qk.packs(runId) });
          toast({
            title: "Manus is building the landing page",
            body: "The link appears here; it is never published by Nexus.",
          });
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409)
            setUnavailable("Manus runs in demo mode here, so no landing page is built.");
          else toast({ title: "Manus did not start", body: e instanceof Error ? e.message : undefined, tone: "fail" });
        } finally {
          setBusy(false);
        }
      }}
      className="self-start rounded-chip border border-line-strong px-3 py-1.5 text-[12.5px] text-bone-2 transition-colors duration-150 hover:border-bone-4 hover:text-bone disabled:opacity-50"
    >
      {busy ? "Asking Manus" : "Build a landing page with Manus"}
    </button>
  );
}
