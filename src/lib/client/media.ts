/** Third-party covers go through the local cache (`/thumb`), so the page never calls a CDN (offline demo). */
export function localMedia<T extends string | undefined>(url: T): T {
  return (url && /^https?:\/\//i.test(url) ? `/thumb?u=${encodeURIComponent(url)}` : url) as T;
}

/** Rewrites every `thumbnailUrl` / `coverUrl` in an API response (evidence, blueprints, questions, plans). */
export function localizeMedia<T>(value: T): T {
  if (Array.isArray(value)) return value.map(localizeMedia) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value))
    out[k] = (k === "thumbnailUrl" || k === "coverUrl") && typeof v === "string" ? localMedia(v) : localizeMedia(v);
  return out as T;
}
