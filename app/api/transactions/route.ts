import { getTransactionsByMonth } from "@/lib/db";

export interface TransactionRow {
  id: number;
  transaction_date: string;
  merchant_raw: string;
  amount: number;
  currency: string | null;
  exchange_rate_metadata: string | null;
  category: string | null;
  confidence: number | null;
  category_source: string | null;
  classified_at: string | null;
}

export interface TransactionsGetResponse {
  transactions: TransactionRow[];
}

/** GET: full transaction list for a statement month. Query: year, month. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  const month = parseInt(url.searchParams.get("month") ?? "", 10);
  if (!year || !month || month < 1 || month > 12) {
    return Response.json(
      { error: "Query params year and month (1-12) required." },
      { status: 400 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "DATABASE_URL not set." }, { status: 500 });
  }

  try {
    const rows = await getTransactionsByMonth(year, month);
    const transactions: TransactionRow[] = rows.map((r) => ({
      id: r.id,
      transaction_date: r.transaction_date,
      merchant_raw: r.merchant_raw,
      amount: Number(r.amount),
      currency: r.currency,
      exchange_rate_metadata: r.exchange_rate_metadata,
      category: r.category ?? null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      category_source: r.category_source ?? null,
      classified_at: r.classified_at != null ? r.classified_at.toISOString() : null,
    }));
    if (transactions.length > 0 && (transactions[0].category != null || transactions[0].confidence != null)) {
      console.log("[transactions GET] Debug: first row has category =", transactions[0].category, "confidence =", transactions[0].confidence);
    }
    return Response.json({ transactions } satisfies TransactionsGetResponse);
  } catch (err) {
    console.error("[transactions GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load transactions." },
      { status: 500 }
    );
  }
}
