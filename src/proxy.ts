import { type NextRequest, NextResponse } from "next/server";

// Read-only showcase (B21, the public AWS build, NEXT_PUBLIC_DATA_MODE=showcase): the site serves the recorded runs and never changes them. Every
// mutating API call is refused with a clear message, so no visitor can start a run, post metrics or spend anything.
export function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "showcase" || ["GET", "HEAD", "OPTIONS"].includes(req.method))
    return NextResponse.next();
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

export const config = { matcher: "/api/:path*" };
