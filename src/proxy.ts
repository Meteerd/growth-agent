import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

/** Constant-time compare of the Basic auth header against STUDIO_AUTH ("user:password"). */
function authorized(req: NextRequest, expected: string): boolean {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  let got: string;
  try {
    got = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxy(req: NextRequest) {
  // The studio server (STUDIO_AUTH set): every page, API call and file needs the operator's password.
  const auth = process.env.STUDIO_AUTH;
  if (auth) {
    if (!authorized(req, auth))
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Rekampols Studio", charset="UTF-8"' },
      });
    if (req.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/studio", req.url));
    return NextResponse.next();
  }
  // Read-only showcase (B21, the public AWS build, NEXT_PUBLIC_DATA_MODE=showcase): the site serves the recorded runs
  // and never changes them. Every mutating API call is refused with a clear message, so no visitor can start a run,
  // post metrics or spend anything. The studio does not exist there.
  if (process.env.NEXT_PUBLIC_DATA_MODE === "showcase") {
    const p = req.nextUrl.pathname;
    if (p.startsWith("/studio") || p.startsWith("/api/studio"))
      return NextResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
    if (p.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method))
      return NextResponse.json(
        {
          error: {
            code: "read_only",
            message:
              "This is the public showcase: it shows recorded runs and changes nothing. Live runs happen in the operator app.",
          },
        },
        { status: 403 },
      );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
