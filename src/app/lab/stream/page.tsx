import type { Metadata } from "next";
import { StreamLog } from "./StreamLog";

export const metadata: Metadata = { title: "Mock stream" };

export default function StreamPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-16 pb-24 md:px-12">
      <p className="mono-label">Instrument check / 02</p>
      <h1 className="mt-3 font-display text-title">Mock event stream</h1>
      <p className="mt-3 max-w-xl text-bone-2 text-ui">
        Plays a full scripted run from the demo fixtures in about 60 seconds, pauses at the consultation until answers
        are posted, then finishes. Every event is also logged to the console. This page always uses the in-browser mock.
      </p>
      <StreamLog />
    </main>
  );
}
