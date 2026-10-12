"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { READ_ONLY } from "@/lib/client/mode";
import { normalizeUrl } from "@/lib/client/url";

/** The site field and the pill button in one rounded bar. The public showcase opens the four real brands instead. */
export function UrlBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string>();
  return (
    <form
      className="w-full max-w-[560px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (READ_ONLY) {
          setNote("This public showcase runs on four real brands. Opening them now.");
          return router.push("/brands");
        }
        const url = normalizeUrl(value);
        if (!url) return setNote("That does not look like a website address.");
        router.push(`/brands/new?url=${encodeURIComponent(url)}`);
      }}
    >
      <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5">
        <label htmlFor="site" className="sr-only">
          Your brand's website
        </label>
        <input
          id="site"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="yourbrand.com"
          autoComplete="url"
          inputMode="url"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-[#111] outline-none placeholder:text-[#8a8a8a]"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-[#111] px-5 py-3 font-semibold text-[15px] text-white transition-colors duration-150 hover:bg-signal focus-visible:bg-signal"
        >
          Take it apart
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 pl-5 text-[13px] text-white/85">
        {note}
      </p>
    </form>
  );
}
