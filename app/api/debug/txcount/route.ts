import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL not set" },
      { status: 500 }
    );
  }

  if (!year || !month) {
    return NextResponse.json(
      { ok: false, error: "Missing year or month" },
      { status: 400 }
    );
  }

  try {
    const pool = await getDb();
    const res = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM transactions
       WHERE statement_year = $1 AND statement_month = $2`,
      [year, month]
    );
    return NextResponse.json({ ok: true, year, month, count: res.rows[0]?.count ?? 0 });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}