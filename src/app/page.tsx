import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/client/product";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-3xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] opacity-60">{PRODUCT_NAME}</p>
        <h1 className="mt-4 font-serif text-5xl leading-none md:text-8xl">{PRODUCT_TAGLINE}</h1>
      </div>
    </main>
  );
}
