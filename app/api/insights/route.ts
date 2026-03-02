import {
  getCategoryBreakdown,
  getRentIncomeForMonth,
  getStatementMonths,
  getCategoryTotalsForMonth,
  getRecurringMerchants,
  getTopMerchantsBySpend,
} from "@/lib/db";
import {
  isEssential,
  isDiscretionary,
  stdDev,
  mean,
  isSpike,
  SPIKE_INCREASE_THRESHOLD,
} from "@/lib/insights";

export interface InsightsResponse {
  cashFlow: {
    monthlyTotalSpend: number;
    spendToIncomeRatio: number | null;
    savingsRate: number | null;
    creditCardSpend: number;
    rent: number | null;
    income: number | null;
  };
  categoryStructure: {
    categoriesBySpend: Array<{ category: string; amount: number; percent: number }>;
    essentialsTotal: number;
    discretionaryTotal: number;
    otherTotal: number;
    essentialsBreakdown: Array<{ category: string; amount: number }>;
    discretionaryBreakdown: Array<{ category: string; amount: number }>;
    otherBreakdown: Array<{ category: string; amount: number }>;
  };
  volatility: {
    categoryVolatilities: Array<{ category: string; stdDev: number; mean: number }>;
    topVolatile: string[];
  };
  spikes: Array<{ category: string; current: number; rollingAvg: number; percentIncrease: number }>;
  recurring: Array<{ merchant_raw: string; months: number }>;
  topMerchants: Array<{ merchant_raw: string; total_spend: number; category: string }>;
}

/** GET: financial indicators & insights for a statement month. Query: year, month. */
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
    const statementMonths = await getStatementMonths();
    const currentKey = `${year}-${String(month).padStart(2, "0")}`;
    const currentIndex = statementMonths.indexOf(currentKey);
    if (currentIndex < 0) {
      return Response.json({
        cashFlow: { monthlyTotalSpend: 0, spendToIncomeRatio: null, savingsRate: null, creditCardSpend: 0, rent: null, income: null },
        categoryStructure: { categoriesBySpend: [], essentialsTotal: 0, discretionaryTotal: 0, otherTotal: 0, essentialsBreakdown: [], discretionaryBreakdown: [], otherBreakdown: [] },
        volatility: { categoryVolatilities: [], topVolatile: [] },
        spikes: [],
        recurring: [],
        topMerchants: [],
      } satisfies InsightsResponse);
    }

    const [breakdown, rentIncome, recurring, topMerchants] = await Promise.all([
      getCategoryBreakdown(year, month),
      getRentIncomeForMonth(year, month),
      getRecurringMerchants(year, month),
      getTopMerchantsBySpend(year, month, 5),
    ]);

    const creditCardSpend = breakdown.totalSpend;
    const rent = rentIncome.rent ?? 0;
    const income = rentIncome.income ?? null;
    const monthlyTotalSpend = creditCardSpend + rent; // total spend = credit card + rent
    const spendToIncomeRatio = income != null && income > 0 ? monthlyTotalSpend / income : null;
    const savingsRate = spendToIncomeRatio != null ? 1 - spendToIncomeRatio : null;

    const rows = [...breakdown.rows].sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));
    const totalSpend = breakdown.totalSpend;
    const categoriesBySpend = rows.map((r) => ({
      category: r.category,
      amount: parseFloat(r.total_amount),
      percent: r.percent,
    }));

    let essentialsTotal = rent;
    let discretionaryTotal = 0;
    let otherTotal = 0;
    const essentialsBreakdown: Array<{ category: string; amount: number }> = rent > 0 ? [{ category: "Rent", amount: rent }] : [];
    const discretionaryBreakdown: Array<{ category: string; amount: number }> = [];
    const otherBreakdown: Array<{ category: string; amount: number }> = [];

    for (const r of rows) {
      const amt = parseFloat(r.total_amount);
      if (isEssential(r.category)) {
        essentialsTotal += amt;
        essentialsBreakdown.push({ category: r.category, amount: amt });
      } else if (isDiscretionary(r.category)) {
        discretionaryTotal += amt;
        discretionaryBreakdown.push({ category: r.category, amount: amt });
      } else {
        otherTotal += amt;
        otherBreakdown.push({ category: r.category, amount: amt });
      }
    }

    const currentTotals = await getCategoryTotalsForMonth(year, month);
    const pastSixKeys = statementMonths.slice(currentIndex + 1, currentIndex + 7);
    const categoryTotalsByMonth: Record<string, number[]> = {};
    for (const ym of pastSixKeys) {
      const [y, m] = ym.split("-").map(Number);
      const totals = await getCategoryTotalsForMonth(y, m);
      for (const [cat, val] of Object.entries(totals)) {
        if (!categoryTotalsByMonth[cat]) categoryTotalsByMonth[cat] = [];
        categoryTotalsByMonth[cat].push(val);
      }
    }
    for (const [cat, val] of Object.entries(currentTotals)) {
      if (!categoryTotalsByMonth[cat]) categoryTotalsByMonth[cat] = [];
      categoryTotalsByMonth[cat].push(val);
    }

    const categoryVolatilities: Array<{ category: string; stdDev: number; mean: number }> = [];
    for (const [cat, values] of Object.entries(categoryTotalsByMonth)) {
      if (values.length >= 2) {
        categoryVolatilities.push({
          category: cat,
          stdDev: stdDev(values),
          mean: mean(values),
        });
      }
    }
    categoryVolatilities.sort((a, b) => b.stdDev - a.stdDev);
    const topVolatile = categoryVolatilities.slice(0, 2).map((v) => v.category);

    const threePreviousKeys = statementMonths.slice(currentIndex + 1, currentIndex + 4);
    const pastThreeTotals: Record<string, number>[] = [];
    for (const ym of threePreviousKeys) {
      const [y, m] = ym.split("-").map(Number);
      pastThreeTotals.push(await getCategoryTotalsForMonth(y, m));
    }

    const spikes: Array<{ category: string; current: number; rollingAvg: number; percentIncrease: number }> = [];
    if (pastThreeTotals.length >= 1) {
      const allCats = new Set<string>([
        ...Object.keys(currentTotals),
        ...pastThreeTotals.flatMap((t) => Object.keys(t)),
      ]);
      for (const cat of allCats) {
        const current = currentTotals[cat] ?? 0;
        const pastValues = pastThreeTotals.map((t) => t[cat] ?? 0);
        const rollingAvg = mean(pastValues);
        if (isSpike(current, rollingAvg, SPIKE_INCREASE_THRESHOLD)) {
          const percentIncrease = rollingAvg > 0 ? ((current - rollingAvg) / rollingAvg) * 100 : 0;
          spikes.push({ category: cat, current, rollingAvg, percentIncrease });
        }
      }
      spikes.sort((a, b) => b.percentIncrease - a.percentIncrease);
    }

    const response: InsightsResponse = {
      cashFlow: {
        monthlyTotalSpend,
        spendToIncomeRatio,
        savingsRate,
        creditCardSpend,
        rent: rentIncome.rent,
        income: rentIncome.income,
      },
      categoryStructure: {
        categoriesBySpend,
        essentialsTotal,
        discretionaryTotal,
        otherTotal,
        essentialsBreakdown,
        discretionaryBreakdown,
        otherBreakdown,
      },
      volatility: { categoryVolatilities, topVolatile },
      spikes,
      recurring,
      topMerchants,
    };
    return Response.json(response);
  } catch (err) {
    console.error("[insights GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load insights." },
      { status: 500 }
    );
  }
}
