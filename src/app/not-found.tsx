import Link from "next/link";
import { Wordmark } from "@/components/shell/Header";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[960px] flex-col px-4 py-6 md:px-8">
      <Wordmark />
      <div className="my-auto py-20">
        <p className="mono-label">404 / off the chart</p>
        <h1 className="mt-4 font-display text-[clamp(2.6rem,7vw,5.5rem)] leading-[1]">Nothing is plotted here.</h1>
        <p className="mt-5 max-w-lg text-bone-2 text-body">
          The link may be old, or the page moved. Brands, runs and results all start from the portfolio.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/brands"
            className="inline-flex h-10 items-center rounded-chip bg-signal px-4 font-medium text-ink text-ui"
          >
            Open the portfolio
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-chip px-4 text-bone text-ui shadow[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-glass"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
