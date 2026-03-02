// app/api/debug/txcount/route.ts
import { NextResponse } from "next/server";
import { Client } from "pg";

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

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // DO Postgres 常见：本地开发先放开校验，先把链路跑通
    ssl:
      process.env.NODE_ENV === "development"
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM transactions
       WHERE statement_year = $1 AND statement_month = $2`,
      [year, month]
    );
    return NextResponse.json({ ok: true, year, month, count: rows[0]?.count ?? 0 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  } finally {
    try {
      await client.end();
    } catch {}
  }
}