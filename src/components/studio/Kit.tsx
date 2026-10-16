"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/client/cn";
import { api, type BrandDetail, type StudioBrandConfig, useRefresh } from "@/lib/client/studio";

const HEAD_FONTS = [
  "jakarta",
  "inter",
  "montserrat",
  "poppins",
  "anton",
  "bebas",
  "serif_dm",
  "serif_playfair",
  "tiktok",
];
const list = (s: string) =>
  s
    .split(/[,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
const field =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-line-strong";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-line border-b py-6 md:grid-cols-[220px_1fr]">
      <div>
        <div className="font-medium text-[14px]">{title}</div>
        {hint && <div className="mt-1 text-[12.5px] text-bone-3">{hint}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Upload({ slug, role, label, onDone }: { slug: string; role: string; label: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center rounded-md border border-line px-3 py-1.5 text-[12.5px] hover:border-line-strong",
        busy && "opacity-50",
      )}
    >
      {busy ? "Uploading..." : label}
      <input
        type="file"
        accept="image/*"
        multiple={role === "image"}
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          if (!files.length) return;
          setBusy(true);
          const fd = new FormData();
          for (const f of files) fd.append("file", f);
          fd.append("role", role);
          try {
            await api.post(`/brands/${slug}/images`, fd);
            onDone();
          } catch (err) {
            toast({ title: "Upload failed", body: err instanceof Error ? err.message : String(err), tone: "fail" });
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}

export function Kit({ slug, d }: { slug: string; d: BrandDetail }) {
  const [c, setC] = useState<StudioBrandConfig>(d.config);
  const [dirty, setDirty] = useState(false);
  const refresh = useRefresh();
  useEffect(() => {
    if (!dirty) setC(d.config);
  }, [d.config, dirty]);
  const set = (p: Partial<StudioBrandConfig>) => {
    setC((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  async function save() {
    try {
      const { brandImages: _bi, logo: _l, logoOnDark: _ld, productShot: _p, ...rest } = c;
      await api.patch(`/brands/${slug}/config`, rest);
      setDirty(false);
      toast({ title: "Brand kit saved", tone: "pass" });
      refresh();
    } catch (e) {
      toast({ title: "Could not save", body: e instanceof Error ? e.message : String(e), tone: "fail" });
    }
  }
  const after = () => {
    setDirty(false);
    refresh();
  };
  return (
    <div className="max-w-5xl">
      {dirty && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-bone px-4 py-2.5 text-[13px] text-white">
          Unsaved changes
          <button type="button" onClick={save} className="rounded bg-white px-3 py-1 text-bone">
            Save
          </button>
        </div>
      )}
      <Section
        title="Logo and product"
        hint="The logo goes on every ad. The product shot is the site or app on a phone."
      >
        <div className="flex flex-wrap items-end gap-6">
          {(["logo", "logoOnDark", "productShot"] as const).map((k) => (
            <div key={k} className="space-y-2">
              <div
                className={cn(
                  "flex size-28 items-center justify-center overflow-hidden rounded-lg border border-line",
                  k === "logoOnDark" ? "bg-[#222]" : "bg-[#F7F6F2]",
                )}
              >
                {c[k] ? (
                  // biome-ignore lint/performance/noImgElement: asset
                  <img
                    src={c[k]}
                    alt=""
                    className={cn(
                      "max-h-full max-w-full",
                      k === "productShot" ? "object-cover object-top" : "object-contain p-2",
                    )}
                  />
                ) : (
                  <span className="text-[11px] text-bone-3">none</span>
                )}
              </div>
              <Upload
                slug={slug}
                role={k === "productShot" ? "product" : k}
                label={k === "logo" ? "Logo" : k === "logoOnDark" ? "Logo for dark" : "Product shot"}
                onDone={after}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Colours and type">
        <div className="flex flex-wrap gap-4">
          {(["primary", "accent", "ink", "paper"] as const).map((k) => (
            <label key={k} className="text-[12px] text-bone-3 capitalize">
              {k}
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={c.colors[k]}
                  onChange={(e) => set({ colors: { ...c.colors, [k]: e.target.value.toUpperCase() } })}
                  className="size-9 rounded border border-line"
                />
                <input
                  value={c.colors[k]}
                  onChange={(e) => set({ colors: { ...c.colors, [k]: e.target.value } })}
                  className={cn(field, "w-24 font-mono")}
                />
              </div>
            </label>
          ))}
          <label className="text-[12px] text-bone-3">
            Logo on ads
            <select
              value={c.logoStyle ?? "image"}
              onChange={(e) => set({ logoStyle: e.target.value as "image" | "wordmark" })}
              className={cn(field, "mt-1 block")}
            >
              <option value="image">Logo image</option>
              <option value="wordmark">Name in type</option>
            </select>
          </label>
          <label className="text-[12px] text-bone-3">
            Headline font
            <select
              value={c.fonts.head}
              onChange={(e) => set({ fonts: { ...c.fonts, head: e.target.value } })}
              className={cn(field, "mt-1 block")}
            >
              {HEAD_FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>
      <Section title="Markets" hint="Where the ads run and in which languages.">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-[12px] text-bone-3">
            Countries
            <input
              defaultValue={c.countries.join(", ")}
              onBlur={(e) => set({ countries: list(e.target.value).map((x) => x.toUpperCase()) })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-bone-3">
            Languages
            <input
              defaultValue={c.languages.join(", ")}
              onBlur={(e) => set({ languages: list(e.target.value).map((x) => x.toLowerCase()) })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-bone-3">
            Default language
            <input
              value={c.defaultLanguage}
              onChange={(e) => set({ defaultLanguage: e.target.value })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-bone-3">
            Placement
            <select
              value={c.placement}
              onChange={(e) => set({ placement: e.target.value as "paid" | "organic" })}
              className={cn(field, "mt-1")}
            >
              <option value="paid">Paid (Meta ads)</option>
              <option value="organic">Organic posts</option>
            </select>
          </label>
          <label className="text-[12px] text-bone-3">
            Image model
            <select
              value={c.imageModel}
              onChange={(e) => set({ imageModel: e.target.value as StudioBrandConfig["imageModel"] })}
              className={cn(field, "mt-1")}
            >
              {d.imageModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-bone-3">
            Landing URL shown on ads
            <input value={c.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} className={cn(field, "mt-1")} />
          </label>
        </div>
      </Section>
      <Section
        title="Competitors"
        hint="Searched in the Meta Ad Library by page name. The page id is filled in after the first scan."
      >
        {c.competitors.map((x, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input
              value={x.name}
              onChange={(e) =>
                set({ competitors: c.competitors.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })
              }
              placeholder="Name"
              className={field}
            />
            <input
              value={x.adLibraryQuery}
              onChange={(e) =>
                set({
                  competitors: c.competitors.map((y, j) => (j === i ? { ...y, adLibraryQuery: e.target.value } : y)),
                })
              }
              placeholder="Facebook page name"
              className={field}
            />
            <input
              value={x.website ?? ""}
              onChange={(e) =>
                set({ competitors: c.competitors.map((y, j) => (j === i ? { ...y, website: e.target.value } : y)) })
              }
              placeholder="Website"
              className={field}
            />
            <button
              type="button"
              onClick={() => set({ competitors: c.competitors.filter((_, j) => j !== i) })}
              className="px-2 text-bone-3 hover:text-fail"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ competitors: [...c.competitors, { name: "", adLibraryQuery: "" }] })}
          className="text-[12.5px] text-bone-2 underline"
        >
          Add a competitor
        </button>
        <label className="block text-[12px] text-bone-3">
          Category search terms (comma separated)
          <input
            defaultValue={c.searchTerms.join(", ")}
            onBlur={(e) => set({ searchTerms: list(e.target.value) })}
            className={cn(field, "mt-1")}
          />
        </label>
      </Section>
      <Section title="What the ads must know" hint="Standing instructions, the offer, required lines. One per line.">
        <label className="block text-[12px] text-bone-3">
          Notes
          <textarea
            defaultValue={c.notes.join("\n")}
            onBlur={(e) =>
              set({
                notes: e.target.value
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            rows={4}
            className={cn(field, "mt-1")}
          />
        </label>
        <label className="block text-[12px] text-bone-3">
          Offer
          <input value={c.offer ?? ""} onChange={(e) => set({ offer: e.target.value })} className={cn(field, "mt-1")} />
        </label>
        <label className="block text-[12px] text-bone-3">
          Required disclaimers
          <textarea
            defaultValue={c.disclaimers.join("\n")}
            onBlur={(e) =>
              set({
                disclaimers: e.target.value
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            rows={2}
            className={cn(field, "mt-1")}
          />
        </label>
      </Section>
      <Section title="Real testimonials" hint="Only real customer words, with consent. The only quotes ads may use.">
        {c.testimonials.map((t, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <input
              value={t.text}
              onChange={(e) =>
                set({ testimonials: c.testimonials.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })
              }
              placeholder="Quote"
              className={field}
            />
            <input
              value={t.author ?? ""}
              onChange={(e) =>
                set({ testimonials: c.testimonials.map((y, j) => (j === i ? { ...y, author: e.target.value } : y)) })
              }
              placeholder="Name, context"
              className={field}
            />
            <input
              value={t.source}
              onChange={(e) =>
                set({ testimonials: c.testimonials.map((y, j) => (j === i ? { ...y, source: e.target.value } : y)) })
              }
              placeholder="Source (App Store, email...)"
              className={field}
            />
            <button
              type="button"
              onClick={() => set({ testimonials: c.testimonials.filter((_, j) => j !== i) })}
              className="px-2 text-bone-3 hover:text-fail"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ testimonials: [...c.testimonials, { text: "", source: "" }] })}
          className="text-[12.5px] text-bone-2 underline"
        >
          Add a testimonial
        </button>
      </Section>
      <Section
        title="Brand images"
        hint="Real photos the ads can use or keep the look of (products, team, pets, places)."
      >
        <Upload slug={slug} role="image" label="Upload images" onDone={after} />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {c.brandImages.map((b) => (
            <div key={b.url} className="group relative overflow-hidden rounded-lg border border-line bg-[#F7F6F2]">
              {/* biome-ignore lint/performance/noImgElement: asset */}
              <img src={b.url} alt="" className="aspect-square w-full object-cover" />
              {b.note && <div className="truncate px-2 py-1 text-[11px] text-bone-3">{b.note}</div>}
              <button
                type="button"
                onClick={async () => {
                  await api.del(`/brands/${slug}/images`, { url: b.url });
                  after();
                }}
                className="absolute top-1 right-1 hidden rounded bg-white/90 px-1.5 text-[11px] text-fail group-hover:block"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
