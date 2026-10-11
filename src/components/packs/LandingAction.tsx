"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import type { PublishPack } from "@/contracts";
import { ApiRequestError, getClient } from "@/lib/client/api";
import { qk } from "@/lib/client/queries";

/** Manus builds a matching landing page for the pack. We link to the Manus task; nothing is published by us. */
export function LandingAction({ pack, runId }: { pack: PublishPack; runId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string>();
  const url = pack.landingUrl;
  if (url && /^https?:\/\//.test(url))
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        data-testid="pack-landing"
        className="font-mono text-[11px] text-signal hover:underline"
      >
        Landing page: open the Manus task
      </a>
    );
  if (unavailable)
    return (
      <p className="font-mono text-[10.5px] text-bone-3" data-testid="pack-landing-off">
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
      className="self-start rounded-chip px-3 py-1.5 font-mono text-[11px] text-bone-2 shadow[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:bg-glass hover:text-bone disabled:opacity-50"
    >
      {busy ? "Asking Manus" : "Build a landing page with Manus"}
    </button>
  );
}
