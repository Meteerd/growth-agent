"use client";

import { useState } from "react";
import { cn } from "@/lib/client/cn";
import { Button } from "./Button";

/** Normalises "hound.app" / "https://hound.app/x" to a URL; returns undefined if it cannot be a site. */
export function normalizeUrl(raw: string): string | undefined {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/\.[a-z]{2,}$/i.test(u.hostname)) return undefined;
    return u.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function UrlInput({
  onSubmit,
  placeholder = "yourbrand.com",
  cta = "Start",
  loading,
  defaultValue = "",
  size = "lg",
  className,
}: {
  onSubmit: (url: string) => void;
  placeholder?: string;
  cta?: string;
  loading?: boolean;
  defaultValue?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string>();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(value);
    if (!url) return setError("That does not look like a website address.");
    setError(undefined);
    onSubmit(url);
  };
  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div
        className={cn(
          "glass group flex items-center gap-2 rounded-chip p-1.5 pl-5 transition-shadow duration-300",
          "focus-within:shadow-[var(--shadow-panel-strong),0_0_0_1px_rgb(229_50_45/0.45)]",
          error && "shadow-[var(--shadow-panel),0_0_0_1px_rgb(192_53_43/0.5)]",
        )}
      >
        <span aria-hidden className="font-mono text-bone-3 text-ui">
          https://
        </span>
        <label htmlFor="brand-url" className="sr-only">
          Brand website
        </label>
        <input
          id="brand-url"
          name="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/^https?:\/\//i, ""));
            if (error) setError(undefined);
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? "brand-url-error" : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-mono text-bone outline-none placeholder:text-bone-4",
            size === "lg" ? "h-11 text-body" : "h-8 text-ui",
          )}
        />
        <Button type="submit" variant="primary" size={size === "lg" ? "lg" : "sm"} loading={loading}>
          {cta}
          <Arrow />
        </Button>
      </div>
      <p id="brand-url-error" role="alert" className="mt-2 h-4 pl-5 font-mono text-[11px] text-fail">
        {error}
      </p>
    </form>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)} fill="none" aria-hidden>
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
