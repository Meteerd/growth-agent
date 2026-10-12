import { type NextRequest, NextResponse } from "next/server";

// Read-only showcase (B21, the public AWS build): the site serves the recorded runs and never changes them. Every
// mutating API call is refused with a clear message, so no visitor can start a run, post metrics or spend anything.
export function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_READONLY !== "1" || ["GET", "HEAD", "OPTIONS"].includes(req.method))
    return NextResponse.next();
  return NextResponse.json(
    {
      error: {
        code: "read_only",
        message:
          "This public showcase is read-only: it shows recorded runs and changes nothing. Run Nexus locally to start a run.",
      },
    },
    { status: 403 },
  );
}

export const config = { matcher: "/api/:path*" };
