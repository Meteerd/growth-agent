"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/client/cn";
import { useBrands, useJobs } from "@/lib/client/studio";
import { Chat } from "./Chat";

/** Studio frame: brands on the left, the work in the middle, the agent chat on the right. */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const brands = useBrands();
  const jobs = useJobs();
  const running = (jobs.data ?? []).filter((j) => j.status === "running" || j.status === "queued").length;
  const [chatOpen, setChatOpen] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem("studio-chat");
      if (v === "0") setChatOpen(false);
    } catch {}
  }, []);
  const toggle = () => {
    setChatOpen((o) => {
      try {
        localStorage.setItem("studio-chat", o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  const slug = path.match(/^\/studio\/([^/]+)/)?.[1];
  const brandSlug = slug && slug !== "jobs" ? slug : undefined;
  return (
    <div className="flex h-dvh overflow-hidden bg-[#F3F1EC] text-bone">
      <aside className="hidden w-60 shrink-0 flex-col border-line border-r bg-white md:flex">
        <Link href="/studio" className="flex items-center gap-2 px-5 pt-5 pb-4">
          <span className="size-2.5 rounded-full bg-signal" />
          <span className="font-semibold text-[15px] tracking-tight">Rekampols Studio</span>
        </Link>
        <div className="px-3 pb-2 text-[11px] text-bone-3 uppercase tracking-wider">Brands</div>
        <nav className="flex-1 overflow-y-auto px-2">
          {(brands.data ?? []).map((b) => (
            <Link
              key={b.slug}
              href={`/studio/${b.slug}`}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px]",
                brandSlug === b.slug ? "bg-[#F3F1EC] font-medium" : "text-bone-2 hover:bg-[#F7F6F2]",
              )}
            >
              {b.logo ? (
                // biome-ignore lint/performance/noImgElement: asset thumbnails
                <img src={b.logo} alt="" className="size-5 rounded object-contain" />
              ) : (
                <span className="size-5 rounded" style={{ background: b.colors.primary }} />
              )}
              <span className="truncate">{b.name}</span>
              {b.counts.ads > 0 && <span className="ml-auto font-mono text-[11px] text-bone-3">{b.counts.ads}</span>}
            </Link>
          ))}
          <Link
            href="/studio?new=1"
            className="mt-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] text-bone-2 hover:bg-[#F7F6F2]"
          >
            <span className="flex size-5 items-center justify-center rounded border border-line-strong text-[13px]">
              +
            </span>
            Add a brand
          </Link>
        </nav>
        <div className="border-line border-t p-2">
          <Link
            href="/studio/jobs"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-[13px]",
              path === "/studio/jobs" ? "bg-[#F3F1EC]" : "text-bone-2 hover:bg-[#F7F6F2]",
            )}
          >
            Jobs and spend
            {running > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-signal">
                <span className="size-1.5 animate-pulse rounded-full bg-signal" />
                {running} running
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="w-full rounded-md px-3 py-2 text-left text-[13px] text-bone-2 hover:bg-[#F7F6F2]"
          >
            {chatOpen ? "Hide the agent" : "Talk to the agent"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      {chatOpen && (
        <aside className="hidden w-[400px] shrink-0 border-line border-l bg-white lg:flex">
          <Chat brand={brandSlug} />
        </aside>
      )}
    </div>
  );
}
