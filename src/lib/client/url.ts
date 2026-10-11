// Pure URL helpers, safe on the server and the client.

/** Normalises "hound.app" / "https://hound.app/x" to a URL; returns undefined if it cannot be a site. */
export function normalizeUrl(raw: string): string | undefined {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return undefined;
  try {
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const u = new URL(withScheme);
    if (!/\.[a-z]{2,}$/i.test(u.hostname)) return undefined;
    // keep the host as typed (the URL API would turn "güzellik.com.tr" into punycode)
    const host = withScheme
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    return `${u.protocol}//${host}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return undefined;
  }
}

/** Host for display, without the URL API's punycode: "https://www.güzel.com.tr/x" -> "güzel.com.tr". */
export function displayHost(url: string) {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0];
}

/** ASCII slug from any brand name: diacritics folded, Turkish dotless i handled. */
export function slugify(name: string) {
  return (
    name
      .replace(/[ıİ]/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  );
}
