"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EventRow } from "@/components/run/EventRow";
import { Page, PageHead } from "@/components/shell/PageHead";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ErrorState } from "@/components/ui/States";
import { UrlInput } from "@/components/ui/UrlInput";
import type { Brand, Run } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { qk, useRunStream } from "@/lib/client/queries";
import { hostname } from "./Portfolio";

export function EnterBrand() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [created, setCreated] = useState<{ brand: Brand; run: Run }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const once = useRef(false);

  const create = async (url: string) => {
    if (pending || created) return; // double-submit guard
    setPending(true);
    setError(undefined);
    try {
      const res = await getClient().createBrand({ url });
      setCreated(res);
      qc.invalidateQueries({ queryKey: qk.brands });
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once for the URL handed over by the landing page
  useEffect(() => {
    const url = params.get("url");
    if (url && !once.current) {
      once.current = true;
      create(url);
    }
  }, []);

  return (
    <Page className="max-w-[1100px]">
      <PageHead
        eyebrow="Enter / new brand"
        title={created ? created.brand.name : "Paste the site. The agent reads it."}
      >
        It creates the brand, reads the site, and lists what it still does not know. Then you consult, it decides and it
        produces.
      </PageHead>
      <div className="grid-cols-1 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {!created && (
            <UrlInput
              onSubmit={create}
              loading={pending}
              defaultValue={params.get("url")?.replace(/^https?:\/\//, "") ?? ""}
              cta="Add brand"
            />
          )}
          {error ? (
            <ErrorState title="The brand was not created" error={error} onRetry={() => setError(undefined)} />
          ) : null}
          {created ? <IntakeStream brand={created.brand} run={created.run} /> : <IdleStream pending={pending} />}
        </div>
        <aside className="flex flex-col gap-3">{created ? <BrandDraft brand={created.brand} /> : <HowItWorks />}</aside>
      </div>
    </Page>
  );
}

function IntakeStream({ brand, run }: { brand: Brand; run: Run }) {
  const stream = useRunStream(run.id);
  const t0 = useRef(Date.now());
  const intakeDone = stream.completed.includes("intake") || stream.ended;
  const router = useRouter();
  useEffect(() => {
    if (!intakeDone) return;
    const t = setTimeout(() => router.push(`/brands/${brand.slug}`), 4000);
    return () => clearTimeout(t);
  }, [intakeDone, router, brand.slug]);
  return (
    <Panel className="overflow-hidden" data-testid="intake-stream">
      <header className="flex items-center justify-between gap-3 border-line border-b px-5 py-3.5">
        <span className="mono-label">intake / {run.id}</span>
        {run.demo && <DemoBadge />}
      </header>
      <ol aria-live="polite" className="max-h-[52vh] min-h-[260px] overflow-y-auto py-3">
        {stream.events.map((e, i) => (
          <EventRow
            key={e.id}
            e={e}
            fresh={i === stream.events.length - 1}
            t={`+${Math.max(0, Math.round((Date.parse(e.ts) - t0.current) / 1000))}s`}
          />
        ))}
        {!intakeDone && (
          <li className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-bone-3">
            <span className="size-1.5 rounded-full bg-signal" /> reading {hostname(brand.url)}
          </li>
        )}
      </ol>
      {intakeDone && (
        <footer
          className="flex flex-wrap items-center justify-between gap-3 border-line border-t px-5 py-4"
          data-testid="intake-done"
        >
          <p className="text-bone text-ui">{brand.name} is in the portfolio. Next: fill the gaps in a consultation.</p>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/brands">Back to portfolio</Link>
            </Button>
            <Button size="sm" variant="primary" asChild>
              <Link href={`/brands/${brand.slug}`}>Open {brand.name}</Link>
            </Button>
          </div>
        </footer>
      )}
    </Panel>
  );
}

function IdleStream({ pending }: { pending: boolean }) {
  return (
    <Panel tone="hairline" className="grid min-h-[260px] place-items-center p-8 text-center">
      <div>
        <p className="font-display text-[24px] text-bone-2">{pending ? "Creating the brand" : "Waiting for a URL"}</p>
        <p className="mt-2 font-mono text-[11px] text-bone-3">Events from the intake run appear here as they happen.</p>
      </div>
    </Panel>
  );
}

function BrandDraft({ brand }: { brand: Brand }) {
  return (
    <Panel tone="flat" className="rise p-5">
      <p className="mono-label">dossier v0</p>
      <h2 className="mt-2 font-medium text-heading">{brand.name}</h2>
      <p className="font-mono text-[11px] text-bone-3">{hostname(brand.url)}</p>
      <p className="mt-5 mono-label">still unknown</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {brand.dossier.gaps.map((g) => (
          <li key={g} className="flex gap-2 text-bone-2 text-ui">
            <span className="text-warn">?</span>
            {g}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HowItWorks() {
  return (
    <Panel tone="hairline" className="p-5">
      <p className="mono-label">what happens</p>
      <ol className="mt-3 flex flex-col gap-3 text-bone-2 text-ui">
        {[
          "Reads the site: offer, proof, tone, colours.",
          "Lists the gaps it could not fill.",
          "Waits for you before it spends anything big.",
        ].map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="font-mono text-[11px] text-bone-3">{String(i + 1).padStart(2, "0")}</span>
            {s}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
