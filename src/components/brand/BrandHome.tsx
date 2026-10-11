"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RunStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import type { Brand, BrandDossier, Run } from "@/contracts";
import { ApiRequestError, getClient } from "@/lib/client/api";
import { referenceImages } from "@/lib/client/brandAssets";
import { cn } from "@/lib/client/cn";
import { formatUsd, PHASE_LABELS, timeAgo } from "@/lib/client/format";
import { qk, useAction, useBrand, useBrandRuns, useBrands } from "@/lib/client/queries";

export function BrandHome({ slug }: { slug: string }) {
  const { data: brand, isLoading, error, refetch } = useBrand(slug);
  if (error) return <ErrorState title="Could not load the brand" error={error} onRetry={() => refetch()} />;
  if (isLoading || !brand)
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <SkeletonCard lines={6} className="h-[480px]" />
        <SkeletonCard lines={4} className="h-[320px]" />
      </div>
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Dossier brand={brand} />
      <aside className="flex flex-col gap-4">
        <HeroVideo slug={brand.slug} />
        <Runs brand={brand} />
        <Sources brand={brand} />
      </aside>
    </div>
  );
}

function Dossier({ brand }: { brand: Brand }) {
  const d = brand.dossier;
  const save = useAction(
    (patch: Partial<BrandDossier>) => getClient().patchDossier(brand.id, patch),
    () => [qk.brand(brand.slug), qk.brand(brand.id), qk.brands],
  );
  const patch = async (p: Partial<BrandDossier>) => {
    await save.mutateAsync(p);
    toast({ title: "Dossier saved", body: "Your edit is locked: later crawls will not overwrite it.", tone: "pass" });
  };
  const images = referenceImages(brand);
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="dossier">
      <Panel className="p-6 md:p-8">
        <p className="mono-label">dossier / what the agent knows</p>
        <EditableText
          label="One-liner"
          value={d.oneLiner}
          serif
          onSave={(v) => patch({ oneLiner: v })}
          empty="No one-liner yet. Add one sentence: what you sell, to whom."
        />
        <EditableText
          label="Positioning"
          value={d.positioning}
          onSave={(v) => patch({ positioning: v })}
          empty="Not known yet."
        />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel tone="flat" className="p-5">
          <p className="mono-label">offers</p>
          {d.offers.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {d.offers.map((o) => (
                <li
                  key={o.name}
                  className="flex items-baseline justify-between gap-3 border-line border-b pb-2 last:border-0"
                >
                  <span className="text-bone text-ui">{o.name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-bone-2">{o.price ?? "price not public"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-bone-3 text-ui">No offers found on the site yet.</p>
          )}
        </Panel>
        <Panel tone="flat" className="p-5">
          <p className="mono-label">voice</p>
          <p className="mt-3 text-bone text-ui">{d.voice.tone || "Tone not known yet."}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
            <List title="do" items={d.voice.do} tone="pass" />
            <List title="don't" items={d.voice.dont} tone="fail" />
          </div>
        </Panel>
      </div>

      {d.personas.length > 0 && (
        <Panel tone="flat" className="p-5">
          <p className="mono-label">who buys</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {d.personas.map((p) => (
              <div key={p.name} className="rounded-card p-4 hairline">
                <h3 className="font-medium text-bone text-ui">{p.name}</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                  <List title="pains" items={p.pains} />
                  <List title="desires" items={p.desires} />
                  <List title="objections" items={p.objections} />
                  <List title="where they are" items={p.whereTheyAre} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <EditableList label="Proof" items={d.proof} onSave={(v) => patch({ proof: v })} />
        <EditableList label="Still unknown" items={d.gaps} onSave={(v) => patch({ gaps: v })} tone="warn" />
        <EditableList
          label="Claims we can make"
          items={d.claimsAllowed}
          onSave={(v) => patch({ claimsAllowed: v })}
          tone="pass"
        />
        <EditableList
          label="Claims we must never make"
          items={d.claimsForbidden}
          onSave={(v) => patch({ claimsForbidden: v })}
          tone="fail"
        />
      </div>

      {(d.visual.colors.length > 0 || images.length > 0) && (
        <Panel tone="flat" className="p-5">
          <p className="mono-label">visual identity</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.visual.colors.map((c) => (
              <span key={c} className="flex items-center gap-2 rounded-chip py-1 pr-3 pl-1 hairline">
                <span
                  className="size-5 rounded-full"
                  style={{ background: c, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.15)" }}
                />
                <span className="font-mono text-[11px] text-bone-2">{c}</span>
              </span>
            ))}
          </div>
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.slice(0, 10).map((src) => (
                // biome-ignore lint/performance/noImgElement: brand reference images from the engine asset route
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-card object-cover hairline"
                />
              ))}
            </div>
          )}
          {d.visual.styleNotes && <p className="mt-3 font-mono text-[11px] text-bone-3">{d.visual.styleNotes}</p>}
        </Panel>
      )}

      {d.competitors.length > 0 && (
        <Panel tone="flat" className="p-5">
          <p className="mono-label">competitors</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {d.competitors.map((c) => (
              <li key={c.name}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-chip px-3 py-1.5 text-bone-2 text-ui hairline hover:text-bone"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {d.operatorNotes && d.operatorNotes.length > 0 && (
        <Panel tone="flat" className="p-5">
          <p className="mono-label">because you said</p>
          <ul className="mt-3 flex flex-col gap-3">
            {d.operatorNotes.map((n) => (
              <li key={n.questionId} className="border-line border-l pl-3">
                <p className="text-bone-3 text-[12px]">{n.prompt}</p>
                <p className="mt-0.5 font-display text-[18px]">{n.answer}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/** The brand's flagship remake, when the engine has rendered one: poster first, then a muted loop. */
function HeroVideo({ slug }: { slug: string }) {
  const { data: brands } = useBrands();
  const hero = brands?.find((b) => b.slug === slug)?.heroVideo;
  if (!hero) return null;
  return (
    <figure className="overflow-hidden rounded-panel bg-viewer" data-testid="hero-video">
      <video
        src={hero.url}
        poster={hero.posterUrl}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        className="mx-auto aspect-[9/16] max-h-[460px] w-auto"
      />
      <figcaption className="flex items-baseline justify-between gap-3 border-[#222] border-t px-4 py-3 text-white">
        <span className="truncate text-[13px]">{hero.title}</span>
        <Link
          href={`/runs/${hero.runId}/studio`}
          className="shrink-0 text-[12px] text-white/70 underline underline-offset-4 hover:text-white"
        >
          Open in the studio
        </Link>
      </figcaption>
    </figure>
  );
}

function Runs({ brand }: { brand: Brand }) {
  const { data: runs, isLoading } = useBrandRuns(brand.id);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  // Default: build on the brand's recorded live research (real evidence, instant), paced so the gathering is
  // visible; fall back to a fresh run when the brand has none. "Fresh research" always gathers live (capped).
  const start = async (fresh = false) => {
    if (starting) return;
    setStarting(true);
    try {
      const client = getClient();
      let run: Run | undefined;
      let reused = false;
      if (!fresh && client.mode === "live") {
        try {
          run = await client.startRun(brand.id, { kind: "full", reuseResearchFrom: "recorded" });
          reused = true;
        } catch (e) {
          if (!(e instanceof ApiRequestError && e.status === 404)) throw e;
        }
      }
      run ??= await client.startRun(brand.id, { kind: "full" });
      router.push(reused ? `/runs/${run.id}?pace=150` : `/runs/${run.id}`);
    } catch (e) {
      toast({ title: "The run did not start", body: e instanceof Error ? e.message : undefined, tone: "fail" });
      setStarting(false);
    }
  };
  return (
    <Panel>
      <PanelHeader
        label="runs"
        title="Go-to-market runs"
        aside={
          <div className="flex items-center gap-1.5">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => start(true)}
              disabled={starting}
              title="Gathers everything live: provider calls, within the spend caps"
              data-testid="start-fresh"
            >
              Fresh research
            </Button>
            <Button variant="primary" size="sm" onClick={() => start()} loading={starting} data-testid="start-run">
              Start a run
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <div className="flex flex-col gap-2 p-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : !runs?.length ? (
        <p className="p-5 text-bone-2 text-ui">
          No runs yet. A run gathers evidence, consults you, decides channels and produces packs.
        </p>
      ) : (
        <ul className="flex flex-col p-2" data-testid="runs">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RunRow({ run: r }: { run: Run }) {
  return (
    <li>
      <Link
        href={`/runs/${r.id}`}
        className="group flex items-center justify-between gap-3 rounded-card px-3 py-3 transition-colors hover:bg-glass"
      >
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] text-bone">{r.id}</p>
          <p className="mt-0.5 font-mono text-[11px] text-bone-3">
            {PHASE_LABELS[r.phase]} / {r.startedAt ? timeAgo(r.startedAt) : "queued"} / {formatUsd(r.costUsd)}
          </p>
        </div>
        <RunStatusBadge status={r.status} />
      </Link>
    </li>
  );
}

function Sources({ brand }: { brand: Brand }) {
  const s = brand.dossier.sources;
  return (
    <Panel tone="flat" className="p-5">
      <p className="mono-label">sources</p>
      {s.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {s.map((x) => (
            <li key={x.url} className="flex items-baseline justify-between gap-3">
              <a
                href={x.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate font-mono text-[11px] text-bone-2 hover:text-bone"
              >
                {x.url.replace(/^https?:\/\//, "")}
              </a>
              <span className="shrink-0 font-mono text-[10.5px] text-bone-3">{timeAgo(x.fetchedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-bone-3 text-ui">Nothing read yet.</p>
      )}
    </Panel>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "pass" | "fail" | "warn" }) {
  return (
    <div>
      <p
        className={cn(
          "mono-label",
          tone === "pass" && "text-pass",
          tone === "fail" && "text-fail",
          tone === "warn" && "text-warn",
        )}
      >
        {title}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 text-bone-2">
        {items.length ? items.map((i) => <li key={i}>{i}</li>) : <li className="text-bone-4">none</li>}
      </ul>
    </div>
  );
}

function EditableText({
  label,
  value,
  onSave,
  serif,
  empty,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  serif?: boolean;
  empty: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const id = `edit-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const focusRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) focusRef.current?.focus();
  }, [editing]);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="group mt-5" data-testid={id}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="mono-label">
          {label}
        </label>
        {!editing && (
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="rounded-chip px-2.5 py-1 font-mono text-[11px] text-bone-3 opacity-70 transition-opacity hover:bg-glass hover:text-bone group-hover:opacity-100"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <textarea
            id={id}
            value={draft}
            ref={focusRef}
            rows={serif ? 2 : 3}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            className={cn(
              "w-full resize-y rounded-card bg-glass px-4 py-3 text-bone outline-none shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:shadow-[inset_0_0_0_1px_rgb(229_50_45/0.5)]",
              serif ? "font-display text-[26px] leading-tight" : "text-body",
            )}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="primary" magnetic={false} onClick={save} loading={saving}>
              Save
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <span className="ml-auto font-mono text-[10.5px] text-bone-3">Cmd+Enter saves, Esc cancels</span>
          </div>
        </div>
      ) : value ? (
        <p
          className={cn(
            "mt-2",
            serif ? "font-display text-[clamp(1.6rem,3vw,2.25rem)] leading-tight" : "text-bone-2 text-body",
          )}
        >
          {value}
        </p>
      ) : (
        <p className="mt-2 text-bone-3 text-ui">{empty}</p>
      )}
    </div>
  );
}

function EditableList({
  label,
  items,
  onSave,
  tone,
}: {
  label: string;
  items: string[];
  onSave: (v: string[]) => Promise<void>;
  tone?: "pass" | "fail" | "warn";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.join("\n"));
  const [saving, setSaving] = useState(false);
  const id = `edit-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const focusRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) focusRef.current?.focus();
  }, [editing]);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(
        draft
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      );
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const dot = tone === "pass" ? "bg-pass" : tone === "fail" ? "bg-fail" : tone === "warn" ? "bg-warn" : "bg-bone-3";
  return (
    <Panel tone="flat" className="group p-5" data-testid={id}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="mono-label">
          {label}
        </label>
        {!editing && (
          <button
            onClick={() => {
              setDraft(items.join("\n"));
              setEditing(true);
            }}
            className="rounded-chip px-2.5 py-1 font-mono text-[11px] text-bone-3 opacity-70 transition-opacity hover:bg-glass hover:text-bone group-hover:opacity-100"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3">
          <textarea
            id={id}
            value={draft}
            ref={focusRef}
            rows={Math.max(3, items.length + 1)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full resize-y rounded-card bg-glass px-3 py-2.5 text-bone text-ui outline-none shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:shadow-[inset_0_0_0_1px_rgb(229_50_45/0.5)]"
          />
          <p className="mt-1 font-mono text-[10.5px] text-bone-3">One per line.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" magnetic={false} onClick={save} loading={saving}>
              Save
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : items.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i} className="flex gap-2.5 text-bone-2 text-ui">
              <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", dot)} />
              {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-bone-3 text-ui">Nothing yet.</p>
      )}
    </Panel>
  );
}
