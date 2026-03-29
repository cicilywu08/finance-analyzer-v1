import { NextRequest } from "next/server";
import { deleteMonth } from "@/lib/db";

export const dynamic = "force-dynamic";

/** DELETE /api/month/2025-09 — delete all transactions and overrides for that month. */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const match = /^(\d{4})-(\d{2})$/.exec(id ?? "");
    if (!match) {
      return Response.json(
        { error: "Invalid month id. Use YYYY-MM." },
        { status: 400 }
      );
    }
    const statementYear = parseInt(match[1], 10);
    const statementMonth = parseInt(match[2], 10);
    if (statementMonth < 1 || statementMonth > 12) {
      return Response.json(
        { error: "Invalid month. Use 01-12." },
        { status: 400 }
      );
    }
    if (!process.env.DATABASE_URL) {
      return Response.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }
    await deleteMonth(statementYear, statementMonth);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/month/[id]]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 500 }
    );
  }
}
