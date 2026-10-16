import { getDb } from "../db/client";
import { HttpError } from "../http";
import { ensureStudioSeeded } from "./config";

/** Studio routes exist only on the studio server (STUDIO=1), never on the public showcase. */
export function studioEnabled() {
  return process.env.STUDIO === "1" || process.env.NODE_ENV !== "production";
}

export async function sdb() {
  if (!studioEnabled()) throw new HttpError(404, "not_found", "Not found");
  const d = await getDb();
  await ensureStudioSeeded(d);
  return d;
}
