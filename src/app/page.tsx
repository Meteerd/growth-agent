import { Cuts } from "@/components/landing/Cuts";
import { Hero } from "@/components/landing/Hero";
import { Brands, Example, Footer, Loop, Rules } from "@/components/landing/Sections";
import { DataModeChip, Wordmark } from "@/components/shell/Header";

export default function Landing() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-8">
          <Wordmark />
          <DataModeChip />
        </div>
      </header>
      <main>
        <Hero />
        <Example />
        <Cuts />
        <Loop />
        <Brands />
        <Rules />
      </main>
      <Footer />
    </>
  );
}
