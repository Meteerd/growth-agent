"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { normalizeUrl } from "@/components/ui/UrlInput";
import { CHANNEL_LABELS, type Channel, type MetricSnapshot, type MetricsRequest, type PublishPack } from "@/contracts";
import { getClient } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { qk, useAction } from "@/lib/client/queries";
import { METRIC_KEYS, type MetricKey, parseMetrics } from "./metrics";

export const inputClass = cn(
  "h-11 w-full min-w-0 rounded-card border border-line-strong bg-raised px-3.5 font-mono text-bone text-ui tabular-nums outline-none",
  "transition-colors duration-150 placeholder:text-bone-4 hover:border-bone-4 focus:border-bone focus-visible:outline-none",
  "aria-invalid:border-fail",
);

const POST_URL_HINT: Partial<Record<Channel, string>> = {
  tiktok: "tiktok.com/@yourbrand/video/...",
  instagram_reels: "instagram.com/reel/...",
  youtube_shorts: "youtube.com/shorts/...",
  x: "x.com/yourbrand/status/...",
  linkedin: "linkedin.com/posts/...",
  reddit: "reddit.com/r/.../comments/...",
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Could not save. Try again.");

/** Invalidated after any pack write: the list here, plus portfolio counts and brand results. */
const packKeys = (runId: string, brandId: string) => [qk.packs(runId), qk.brands, qk.results(brandId)];

export function MarkPostedDialog({ pack, runId }: { pack: PublishPack; runId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const action = useAction(
    (postedUrl: string) => getClient().markPosted(pack.id, { postedUrl }),
    () => packKeys(runId, pack.brandId),
  );
  const platform = CHANNEL_LABELS[pack.platform];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.isPending) return; // double-submit guard
    const url = normalizeUrl(value);
    if (!url) return setError("That does not look like a link. Paste the full post URL.");
    setError(undefined);
    action.mutate(url, {
      onSuccess: () => {
        setOpen(false);
        setValue("");
        toast({
          title: "Marked as posted",
          body: `Enter metrics when ${platform} shows the first numbers.`,
          tone: "pass",
        });
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(undefined);
      }}
      title="Mark as posted"
      description={`Paste the link to the live ${platform} post so its results can be followed.`}
      trigger={
        <Button className="flex-1" data-testid="pack-mark-posted">
          <CheckGlyph />
          Mark posted
        </Button>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-url`} className="mono-label">
            Post URL
          </label>
          <input
            id={`${id}-url`}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder={POST_URL_HINT[pack.platform] ?? "Paste the post link"}
            aria-invalid={!!error}
            aria-describedby={`${id}-err`}
            className={inputClass}
          />
          <p id={`${id}-err`} role="alert" className="min-h-4 text-[12px] text-fail">
            {error}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={action.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const EMPTY: Record<MetricKey, string> = { views: "", likes: "", comments: "", shares: "", saves: "", follows: "" };

export function MetricsDialog({
  pack,
  runId,
  last,
  onSaved,
}: {
  pack: PublishPack;
  runId: string;
  last?: MetricSnapshot;
  onSaved: (s: MetricSnapshot) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [bad, setBad] = useState<MetricKey[]>([]);
  const [error, setError] = useState<string>();
  const action = useAction(
    (req: MetricsRequest) => getClient().addMetrics(pack.id, req),
    () => packKeys(runId, pack.brandId),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.isPending) return;
    const parsed = parseMetrics(values);
    setBad(parsed.bad);
    if (parsed.bad.length) return setError(`Use whole numbers of zero or more for ${parsed.bad.join(", ")}.`);
    if (parsed.empty) return setError("Enter at least one number.");
    setError(undefined);
    action.mutate(parsed.req, {
      onSuccess: (snap) => {
        onSaved(snap);
        setOpen(false);
        setValues(EMPTY);
        toast({ title: "Metrics saved", body: "The card shows the latest numbers.", tone: "pass" });
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError(undefined);
          setBad([]);
        }
      }}
      title="Enter metrics"
      description="Copy the numbers from the platform's own insights. Leave a field blank if you do not have it."
      trigger={
        <Button className="flex-1" data-testid="pack-enter-metrics">
          <PlusGlyph />
          Enter metrics
        </Button>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRIC_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-2">
              <label htmlFor={`${id}-${k}`} className="mono-label">
                {k}
              </label>
              <input
                id={`${id}-${k}`}
                inputMode="numeric"
                autoComplete="off"
                value={values[k]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [k]: e.target.value }));
                  if (error) setError(undefined);
                  if (bad.includes(k)) setBad((b) => b.filter((x) => x !== k));
                }}
                placeholder={last?.[k] != null ? String(last[k]) : undefined}
                aria-invalid={bad.includes(k)}
                aria-describedby={`${id}-err`}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <p id={`${id}-err`} role="alert" className="min-h-4 text-[12px] text-fail">
          {error}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-bone-3">
            {last ? "Placeholders show the last numbers you entered." : "Saved as a manual snapshot with a timestamp."}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={action.isPending}>
              Save metrics
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", className)} fill="none" aria-hidden>
      <path d="m3.5 8.4 2.9 2.8 6.1-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
