import {
  getStatementMonths,
  getCategoryBreakdown,
  getRentIncomeForMonth,
  getRecurringMerchants,
  getTopMerchantsBySpend,
  getCategoryTotalsForMonth,
} from "@/lib/db";
import { isEssential, isDiscretionary, stdDev, mean } from "@/lib/insights";

const MAX_MONTHS = 12;

export interface SummaryResponse {
  needMoreMonths?: boolean;
  message?: string;
  monthsAnalyzed?: number;
  lifetime?: {
    avgMonthlySpend: number;
    avgSavingsRate: number | null;
    overallSpend: number;
    overallSaving: number | null;
    highestSpendMonth: { yearMonth: string; amount: number };
    lowestSpendMonth: { yearMonth: string; amount: number };
  };
  categoryStructure?: {
    categoriesBySpend: Array<{ category: string; amount: number; percent: number }>;
    essentialsTotal: number;
    discretionaryTotal: number;
    essentialsPct: number;
    discretionaryPct: number;
  };
  savingsStability?: {
    avgSavingsRate: number | null;
    savingsRateStdDev: number;
    pctMonthsPositiveSavings: number;
    savingsRateByMonth: number[];
    yearMonths: string[];
  };
  volatility?: {
    categoryVolatilities: Array<{ category: string; volatility: number; mean: number; stdDev: number }>;
    topVolatile: string[];
  };
  recurring?: {
    avgMonthlySubscriptionTotal: number;
    recurringMerchantCount: number;
    trend: "increasing" | "stable" | "decreasing";
    recurringMerchants: Array<{ merchant_raw: string; months: number }>;
  };
  merchantConcentration?: {
    topMerchants: Array<{ merchant_raw: string; total_spend: number; category: string; percent: number }>;
    totalSpend: number;
    largestSingleConcentration: number;
  };
  behavioralInsights?: string[];
}

/** GET: aggregate insights across up to 12 months. Returns needMoreMonths if < 2 months. */
export async function GET(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json({ needMoreMonths: true, message: "Database not configured." });
  }
  try {
    const allMonths = await getStatementMonths();
    const months = allMonths.slice(0, MAX_MONTHS);
    if (months.length < 2) {
      return Response.json({
        needMoreMonths: true,
        message: "Summary requires at least 2 months of data.",
      } satisfies SummaryResponse);
    }

    const sortedMonths = [...months].sort();

    type MonthData = {
      yearMonth: string;
      totalSpend: number;
      rent: number;
      income: number | null;
      savingsRate: number | null;
      categoryTotals: Record<string, number>;
      subscriptionTotal: number;
      recurringMerchants: Array<{ merchant_raw: string; months: number }>;
      topMerchants: Array<{ merchant_raw: string; total_spend: number; category: string }>;
    };

    const perMonth: MonthData[] = [];
    for (const ym of sortedMonths) {
      const [y, m] = ym.split("-").map(Number);
      const [breakdown, rentIncome, recurring, topMerchants, categoryTotals] = await Promise.all([
        getCategoryBreakdown(y, m),
        getRentIncomeForMonth(y, m),
        getRecurringMerchants(y, m),
        getTopMerchantsBySpend(y, m, 10),
        getCategoryTotalsForMonth(y, m),
      ]);
      const rent = rentIncome.rent ?? 0;
      const income = rentIncome.income ?? null;
      const creditSpend = breakdown.totalSpend;
      const totalSpend = creditSpend + rent;
      const savingsRate =
        income != null && income > 0 ? 1 - totalSpend / income : null;
      const subscriptionTotal = categoryTotals["Subscriptions"] ?? 0;
      perMonth.push({
        yearMonth: ym,
        totalSpend,
        rent,
        income,
        savingsRate,
        categoryTotals,
        subscriptionTotal,
        recurringMerchants: recurring,
        topMerchants,
      });
    }

    const n = perMonth.length;
    const avgMonthlySpend = mean(perMonth.map((d) => d.totalSpend));
    const savingsRates = perMonth.map((d) => d.savingsRate).filter((r): r is number => r != null);
    const avgSavingsRate = savingsRates.length > 0 ? mean(savingsRates) : null;
    const savingsRateStdDev = savingsRates.length >= 2 ? stdDev(savingsRates) : 0;
    const pctMonthsPositiveSavings =
      savingsRates.length > 0 ? (savingsRates.filter((r) => r >= 0).length / savingsRates.length) * 100 : 0;

    const maxSpend = Math.max(...perMonth.map((d) => d.totalSpend));
    const minSpend = Math.min(...perMonth.map((d) => d.totalSpend));
    const highestSpendMonth = perMonth.find((d) => d.totalSpend === maxSpend)!;
    const lowestSpendMonth = perMonth.find((d) => d.totalSpend === minSpend)!;

    const categorySums: Record<string, number> = {};
    for (const d of perMonth) {
      for (const [cat, amt] of Object.entries(d.categoryTotals)) {
        categorySums[cat] = (categorySums[cat] ?? 0) + amt;
      }
    }
    const totalAllCategories = Object.values(categorySums).reduce((a, b) => a + b, 0);
    const categoriesBySpend = Object.entries(categorySums)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: totalAllCategories > 0 ? (amount / totalAllCategories) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    let essentialsTotal = 0;
    let discretionaryTotal = 0;
    for (const [cat, amt] of Object.entries(categorySums)) {
      if (isEssential(cat)) essentialsTotal += amt;
      else if (isDiscretionary(cat)) discretionaryTotal += amt;
    }
    const totalForRatio = essentialsTotal + discretionaryTotal;
    const essentialsPct = totalForRatio > 0 ? (essentialsTotal / totalForRatio) * 100 : 0;
    const discretionaryPct = totalForRatio > 0 ? (discretionaryTotal / totalForRatio) * 100 : 0;

    const categoryValuesByMonth: Record<string, number[]> = {};
    for (const cat of Object.keys(categorySums)) {
      categoryValuesByMonth[cat] = perMonth.map((d) => d.categoryTotals[cat] ?? 0);
    }
    const categoryVolatilities: Array<{ category: string; volatility: number; mean: number; stdDev: number }> = [];
    for (const [cat, values] of Object.entries(categoryValuesByMonth)) {
      const m = mean(values);
      if (m > 0 && values.length >= 2) {
        const s = stdDev(values);
        categoryVolatilities.push({
          category: cat,
          volatility: s / m,
          mean: m,
          stdDev: s,
        });
      }
    }
    categoryVolatilities.sort((a, b) => b.volatility - a.volatility);
    const topVolatile = categoryVolatilities.slice(0, 3).map((v) => v.category);

    const recurringSet = new Set<string>();
    for (const d of perMonth) {
      for (const r of d.recurringMerchants) {
        recurringSet.add(r.merchant_raw);
      }
    }
    const recurringMerchantList: Array<{ merchant_raw: string; months: number }> = [];
    const merchantMonthCount: Record<string, number> = {};
    for (const d of perMonth) {
      for (const r of d.recurringMerchants) {
        merchantMonthCount[r.merchant_raw] = Math.max(merchantMonthCount[r.merchant_raw] ?? 0, r.months);
      }
    }
    for (const [name, months] of Object.entries(merchantMonthCount)) {
      recurringMerchantList.push({ merchant_raw: name, months });
    }
    recurringMerchantList.sort((a, b) => b.months - a.months);

    const avgSubscriptionTotal = mean(perMonth.map((d) => d.subscriptionTotal));
    const half = Math.floor(n / 2);
    const firstHalfAvg = half > 0 ? mean(perMonth.slice(0, half).map((d) => d.subscriptionTotal)) : 0;
    const secondHalfAvg = n - half > 0 ? mean(perMonth.slice(half).map((d) => d.subscriptionTotal)) : 0;
    const trend =
      secondHalfAvg > firstHalfAvg * 1.05 ? "increasing" : firstHalfAvg > secondHalfAvg * 1.05 ? "decreasing" : "stable";

    const merchantTotals: Record<string, { total_spend: number; category: string }> = {};
    for (const d of perMonth) {
      for (const m of d.topMerchants) {
        if (!merchantTotals[m.merchant_raw]) {
          merchantTotals[m.merchant_raw] = { total_spend: 0, category: m.category };
        }
        merchantTotals[m.merchant_raw].total_spend += m.total_spend;
      }
    }
    const totalSpendAllMonths = perMonth.reduce((a, d) => a + d.totalSpend, 0);
    const topMerchantsAll = Object.entries(merchantTotals)
      .map(([merchant_raw, v]) => ({ merchant_raw, ...v }))
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, 5)
      .map((m) => ({
        ...m,
        percent: totalSpendAllMonths > 0 ? (m.total_spend / totalSpendAllMonths) * 100 : 0,
      }));
    const largestSingleConcentration =
      topMerchantsAll.length > 0 && totalSpendAllMonths > 0
        ? (topMerchantsAll[0].total_spend / totalSpendAllMonths) * 100
        : 0;

    const behavioralInsights: string[] = [];
    if (categoryVolatilities.length > 0) {
      const top = categoryVolatilities[0];
      if (top.volatility > 0.5) {
        behavioralInsights.push(
          `${top.category} spending varies considerably month to month (high volatility).`
        );
      }
    }
    const diningCat = categoryVolatilities.find((v) => v.category.includes("Dining"));
    if (diningCat && diningCat.volatility > 0.3) {
      behavioralInsights.push("Dining spending shows notable variation across months.");
    }
    if (trend === "increasing" && avgSubscriptionTotal > 0) {
      behavioralInsights.push("Recurring subscription costs have increased over the period.");
    }
    if (behavioralInsights.length === 0 && categoriesBySpend.length > 0) {
      const topCat = categoriesBySpend[0];
      behavioralInsights.push(
        `Most spending over the period went to ${topCat.category} (${topCat.percent.toFixed(0)}% of total).`
      );
    }

    const overallSpend = totalSpendAllMonths;
    const overallSaving = perMonth.some((d) => d.income != null)
      ? perMonth.reduce((sum, d) => sum + (d.income ?? 0) - d.totalSpend, 0)
      : null;

    const response: SummaryResponse = {
      monthsAnalyzed: n,
      lifetime: {
        avgMonthlySpend,
        avgSavingsRate,
        overallSpend,
        overallSaving,
        highestSpendMonth: { yearMonth: highestSpendMonth.yearMonth, amount: maxSpend },
        lowestSpendMonth: { yearMonth: lowestSpendMonth.yearMonth, amount: minSpend },
      },
      categoryStructure: {
        categoriesBySpend,
        essentialsTotal,
        discretionaryTotal,
        essentialsPct,
        discretionaryPct,
      },
      savingsStability: {
        avgSavingsRate,
        savingsRateStdDev,
        pctMonthsPositiveSavings,
        savingsRateByMonth: perMonth.map((d) => (d.savingsRate != null ? d.savingsRate * 100 : 0)),
        yearMonths: sortedMonths,
      },
      volatility: {
        categoryVolatilities,
        topVolatile,
      },
      recurring: {
        avgMonthlySubscriptionTotal: avgSubscriptionTotal,
        recurringMerchantCount: recurringSet.size,
        trend,
        recurringMerchants: recurringMerchantList.slice(0, 15),
      },
      merchantConcentration: {
        topMerchants: topMerchantsAll,
        totalSpend: totalSpendAllMonths,
        largestSingleConcentration,
      },
      behavioralInsights: behavioralInsights.slice(0, 3),
    };
    return Response.json(response);
  } catch (err) {
    console.error("[summary GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load summary." },
      { status: 500 }
    );
  }
}
