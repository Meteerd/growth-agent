import type { z } from "zod";
import { getDb } from "./db/client";
import { ensureSeeded } from "./seed";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "bad_json", "Body must be valid JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new HttpError(400, "invalid_body", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

/** DB handle for route handlers: migrated and seeded. */
export async function db() {
  const d = await getDb();
  await ensureSeeded(d);
  return d;
}

/** Wrap a route handler: maps HttpError and unexpected errors to `{error:{code,message}}`. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e.status, e.code, e.message);
      console.error("[api]", e);
      return errorResponse(500, "internal", e instanceof Error ? e.message : "Internal error");
    }
  };
}
