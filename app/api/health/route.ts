import { NextResponse } from "next/server";

/** GET /api/health — deployment check. Does not expose secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hasDb: !!process.env.DATABASE_URL,
  });
}
