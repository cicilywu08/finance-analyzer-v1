import { getStatementMonths } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = "no-store, max-age=0";

export interface MonthsGetResponse {
  months: string[];
}

/** GET: list of statement months (YYYY-MM) that have transactions. Returns [] if DATABASE_URL not set. */
export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": NO_STORE };
  if (!process.env.DATABASE_URL) {
    return Response.json({ months: [] } satisfies MonthsGetResponse, { headers });
  }
  try {
    const months = await getStatementMonths();
    return Response.json({ months } satisfies MonthsGetResponse, { headers });
  } catch (err) {
    console.error("[months GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load months." },
      { status: 500, headers }
    );
  }
}
