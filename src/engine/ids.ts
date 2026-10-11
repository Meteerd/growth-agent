import { randomBytes } from "node:crypto";

/** Sortable unique id: <prefix>_<ms base36><random>. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString("hex")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "brand"
  );
}
