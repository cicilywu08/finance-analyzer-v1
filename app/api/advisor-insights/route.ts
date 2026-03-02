import {
  initSchema,
  getCategoryBreakdown,
  getRentIncomeForMonth,
  getTopMerchantsBySpend,
} from "@/lib/db";
import { isEssential, isDiscretionary } from "@/lib/insights";
import { getAdvisorInsights, type AdvisorSections } from "@/lib/llm/advisorInsights";

/** POST: generate advisor insights for a statement month. Body: { year, month }. */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let year: number;
  let month: number;
  try {
    const body = await request.json().catch(() => ({}));
    year = typeof body.year === "number" ? body.year : parseInt(String(body.year ?? url.searchParams.get("year") ?? ""), 10);
    month = typeof body.month === "number" ? body.month : parseInt(String(body.month ?? url.searchParams.get("month") ?? ""), 10);
  } catch {
    year = parseInt(url.searchParams.get("year") ?? "", 10);
    month = parseInt(url.searchParams.get("month") ?? "", 10);
  }
  if (!year || !month || month < 1 || month > 12) {
    return Response.json(
      { error: "year and month (1-12) required in body or query." },
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
    await initSchema();
    const [breakdown, rentIncome, topMerchants] = await Promise.all([
      getCategoryBreakdown(year, month),
      getRentIncomeForMonth(year, month),
      getTopMerchantsBySpend(year, month, 5),
    ]);

    const rent = rentIncome.rent ?? 0;
    const income = rentIncome.income ?? null;
    const monthlyTotalSpend = breakdown.totalSpend + rent;
    const savingsRate =
      income != null && income > 0 ? 1 - monthlyTotalSpend / income : null;

    const essentialsBreakdown: Array<{ category: string; amount: number }> =
      rent > 0 ? [{ category: "Rent", amount: rent }] : [];
    const discretionaryBreakdown: Array<{ category: string; amount: number }> = [];
    const otherBreakdown: Array<{ category: string; amount: number }> = [];

    for (const r of breakdown.rows) {
      const amt = parseFloat(r.total_amount);
      if (isEssential(r.category)) {
        essentialsBreakdown.push({ category: r.category, amount: amt });
      } else if (isDiscretionary(r.category)) {
        discretionaryBreakdown.push({ category: r.category, amount: amt });
      } else if (r.category !== "Card Payment") {
        otherBreakdown.push({ category: r.category, amount: amt });
      }
    }

    const sections: AdvisorSections = await getAdvisorInsights({
      income,
      total_spend: monthlyTotalSpend,
      savings_rate: savingsRate,
      essentialsBreakdown,
      discretionaryBreakdown,
      otherBreakdown,
      topMerchants,
    });

    return Response.json(sections);
  } catch (err) {
    console.error("[advisor-insights POST]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Advisor insights failed." },
      { status: 500 }
    );
  }
}
