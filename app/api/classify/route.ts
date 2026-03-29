import {
  getDb,
  getUnclassifiedTransactions,
  updateTransactionCategory,
  getCategoryBreakdown,
  getMerchantCached,
  upsertMerchantCache,
  correctCardPaymentDescriptions,
  getRentIncomeForMonth,
} from "@/lib/db";
import { classifyBatch } from "@/lib/llm/classifyOpenAI";
import type { TransactionForClassify } from "@/lib/llm/classifyOpenAI";

const BATCH_SIZE = 20;
const CACHE_MIN_CONFIDENCE = 0.8;

export interface ClassifyPostResponse {
  classifiedCount: number;
  lowConfidenceCount: number;
  remainingCount: number;
}

export interface ClassifyGetResponse {
  rows: { category: string; total_amount: string; percent: number }[];
  totalCredits: number;
  lowConfidenceCount: number;
  netSpendTotal: number;
  /** Total spend = sum of category totalAmount (excludes Card Payment). */
  totalSpend: number;
  rent: number | null;
  income: number | null;
}

/** POST: run classification for statement month. Query: year, month. */
export async function POST(request: Request): Promise<Response> {
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
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY not set." }, { status: 500 });
  }

  try {
    const { count: corrected, merchantRaws } = await correctCardPaymentDescriptions(year, month);
    if (corrected > 0) {
      console.log("[classify POST] Corrected", corrected, "card-payment description(s) to Card Payment");
      for (const raw of merchantRaws) {
        await upsertMerchantCache(raw, "Card Payment", 1, "override");
      }
    }
    let unclassified = await getUnclassifiedTransactions(year, month);
    const toFetch: typeof unclassified = [];
    const cached: { id: number; category: string; confidence: number }[] = [];

    for (const t of unclassified) {
      const hit = await getMerchantCached(t.merchant_raw, CACHE_MIN_CONFIDENCE);
      if (hit) {
        cached.push({ id: t.id, category: hit.category, confidence: hit.confidence });
      } else {
        toFetch.push(t);
      }
    }

    for (const { id, category, confidence } of cached) {
      await updateTransactionCategory(id, category, confidence, "cache");
    }
    const cacheUpsert = async (merchant: string, cat: string, conf: number) => {
      await upsertMerchantCache(merchant, cat, conf, "llm");
    };

    let lowConfidenceCount = cached.filter((c) => c.confidence < 0.6).length;

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const input: TransactionForClassify[] = batch.map((t) => ({
        id: t.id,
        merchant_raw: t.merchant_raw,
        amount: t.amount,
        transaction_date: t.transaction_date,
        exchange_rate_metadata: t.exchange_rate_metadata,
      }));
      const results = await classifyBatch(input);
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const t = batch[j];
        if (!t) continue;
        await updateTransactionCategory(t.id, r.category, r.confidence, "llm");
        if (r.confidence < 0.6) lowConfidenceCount++;
        await cacheUpsert(t.merchant_raw, r.category, r.confidence);
      }
    }

    unclassified = await getUnclassifiedTransactions(year, month);
    const classifiedCount = cached.length + toFetch.length;

    const pool = await getDb();
    const countRes = await pool.query<{ n: string }>(
      "SELECT COUNT(*)::TEXT AS n FROM transactions WHERE statement_year = $1 AND statement_month = $2 AND category IS NOT NULL",
      [year, month]
    );
    const categorizedCount = countRes.rows[0] ? parseInt(countRes.rows[0].n, 10) : 0;
    console.log("[classify POST] Debug: rows with category IS NOT NULL =", categorizedCount, "for", year, month);

    return Response.json({
      classifiedCount,
      lowConfidenceCount,
      remainingCount: unclassified.length,
    } satisfies ClassifyPostResponse);
  } catch (err) {
    console.error("[classify POST]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Classification failed." },
      { status: 500 }
    );
  }
}

/** GET: category breakdown for statement month. Query: year, month. */
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
    const [breakdown, rentIncome] = await Promise.all([
      getCategoryBreakdown(year, month),
      getRentIncomeForMonth(year, month),
    ]);
    const { rows, totalCredits, lowConfidenceCount, netSpendTotal, totalSpend } = breakdown;
    return Response.json({
      rows,
      totalCredits,
      lowConfidenceCount,
      netSpendTotal,
      totalSpend,
      rent: rentIncome.rent,
      income: rentIncome.income,
    } satisfies ClassifyGetResponse);
  } catch (err) {
    console.error("[classify GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load breakdown." },
      { status: 500 }
    );
  }
}
