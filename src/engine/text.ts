/** Scraped text cut mid-character leaves half a surrogate pair: valid for JSON.parse, but bundlers and APIs may refuse it. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const wellFormed = (s: string) => s.replace(LONE_SURROGATE, "");

/** Every string inside a JSON-like value, well formed. */
export function wellFormedDeep<T>(v: T): T {
  if (typeof v === "string") return wellFormed(v) as T;
  if (Array.isArray(v)) return v.map(wellFormedDeep) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wellFormedDeep(x)])) as T;
  return v;
}
