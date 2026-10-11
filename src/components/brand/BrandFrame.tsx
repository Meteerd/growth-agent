"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Page } from "@/components/shell/PageHead";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/client/cn";
import { VERTICAL_LABELS } from "@/lib/client/format";
import { useBrand } from "@/lib/client/queries";
import { BrandMark } from "./BrandMark";
import { hostname } from "./Portfolio";

/** Shared brand header + sub navigation for every /brands/[slug] screen. */
export function BrandFrame({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { data: b, isLoading, error } = useBrand(slug);
  const path = usePathname();
  const tabs = [
    { href: `/brands/${slug}`, label: "Dossier" },
    { href: `/brands/${slug}/connect`, label: "Connect" },
    { href: `/brands/${slug}/results`, label: "Results" },
  ];
  if (error)
    return (
      <Page>
        <EmptyState
          className="mt-16"
          title="This brand is not in the portfolio"
          action={
            <Link className="font-mono text-[12px] text-signal underline underline-offset-4" href="/brands">
              Back to the portfolio
            </Link>
          }
        >
          The link may be old, or the brand was created in another session.
        </EmptyState>
      </Page>
    );
  return (
    <Page>
      <div className="flex flex-col gap-5 pt-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {b ? <BrandMark brand={b} size={52} /> : <Skeleton className="size-[52px] rounded-[10px]" />}
          <div className="min-w-0">
            <p className="mono-label">
              <Link href="/brands" className="hover:text-bone">
                Portfolio
              </Link>{" "}
              / brand
            </p>
            {isLoading || !b ? (
              <Skeleton className="mt-2 h-8 w-48" />
            ) : (
              <h1 className="mt-1 truncate font-display text-[clamp(2rem,4vw,3rem)] leading-none">{b.name}</h1>
            )}
          </div>
        </div>
        {b && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{hostname(b.url)}</Badge>
            <Badge>{VERTICAL_LABELS[b.vertical] ?? b.vertical}</Badge>
            {b.countries.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
            <Badge tone="violet">{b.rulePack}</Badge>
            {b.demo && <DemoBadge />}
          </div>
        )}
      </div>
      <nav aria-label="Brand" className="mt-6 flex gap-1 border-line border-b">
        {tabs.map((t) => {
          const active = t.href === path;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3 pt-2 pb-3 text-ui transition-colors duration-150",
                active ? "text-bone" : "text-bone-3 hover:text-bone-2",
              )}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 -bottom-px h-px bg-signal" />}
            </Link>
          );
        })}
      </nav>
      <div className="pt-8">{children}</div>
    </Page>
  );
}
