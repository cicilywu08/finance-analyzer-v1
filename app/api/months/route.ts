import { initSchema, getStatementMonths } from "@/lib/db";

export interface MonthsGetResponse {
  months: string[];
}

/** GET: list of statement months (YYYY-MM) that have transactions. Returns [] if DATABASE_URL not set. */
export async function GET(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json({ months: [] } satisfies MonthsGetResponse);
  }
  try {
    await initSchema();
    const months = await getStatementMonths();
    return Response.json({ months } satisfies MonthsGetResponse);
  } catch (err) {
    console.error("[months GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load months." },
      { status: 500 }
    );
  }
}
