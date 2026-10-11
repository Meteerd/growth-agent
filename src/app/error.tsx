"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Last-resort boundary: a designed screen, the error message, and two ways forward. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-[960px] flex-col justify-center px-4 py-16 md:px-8">
      <p className="mono-label text-fail">error / the screen stopped</p>
      <h1 className="mt-4 font-serif text-[clamp(2.4rem,6vw,4.5rem)] leading-[1]">Something broke on this screen.</h1>
      <p className="mt-4 max-w-xl font-mono text-[12px] text-bone-2">{error.message || "Unknown error"}</p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center rounded-chip bg-signal px-4 font-medium text-ink text-ui"
        >
          Try again
        </button>
        <Link
          href="/brands"
          className="inline-flex h-10 items-center rounded-chip px-4 text-bone text-ui shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-glass"
        >
          Back to the portfolio
        </Link>
      </div>
    </main>
  );
}
