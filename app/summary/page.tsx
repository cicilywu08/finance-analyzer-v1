"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface SummaryData {
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

function formatAmount(value: number): string {
  if (Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m)) return yearMonth;
  const date = new Date(y, m - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const CATEGORY_CHART_COLORS: Record<string, string> = {
  Shopping: "#DE5593",
  Lodging: "#9469E4",
  Dining: "#E88C4B",
  "Dining & Cafes": "#F4A261",
  Groceries: "#62B882",
  Bills: "#757EDD",
  Transport: "#63B8E8",
  Health: "#A8E8BE",
  Subscriptions: "#4FC8D0",
  Entertainment: "#E07A5F",
  Fees: "#8B9DC3",
  Cash: "#6B7280",
};
const FALLBACK_COLORS_BY_INDEX = [
  "#C9B1BD", "#81B29A", "#F2CC8F", "#E0AFA0", "#BC4749", "#7B68EE", "#20B2AA", "#FF7F50",
  "#9370DB", "#3CB371", "#DDA0DD", "#F0E68C", "#87CEEB", "#D2691E", "#CD5C5C", "#9ACD32",
  "#FF69B4", "#40E0D0", "#FFD700", "#778899",
];
function getCategoryColor(category: string, index: number): string {
  if (CATEGORY_CHART_COLORS[category] != null) return CATEGORY_CHART_COLORS[category];
  return FALLBACK_COLORS_BY_INDEX[index % FALLBACK_COLORS_BY_INDEX.length] ?? "#94a3b8";
}

export default function SummaryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/summary")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load summary");
        }
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
        <p className="mt-4 text-zinc-500">Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
        <p className="mt-4 text-red-600" role="alert">{error}</p>
      </div>
    );
  }
  if (data?.needMoreMonths) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
        <p className="mt-4 text-zinc-600">
          {data.message ?? "Summary requires at least 2 months of data."}
        </p>
      </div>
    );
  }
  if (!data?.lifetime) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
        <p className="mt-4 text-zinc-600">
          {data?.error ?? "Summary requires at least 2 months of data. Upload more statements or open Dashboard for a single month."}
        </p>
      </div>
    );
  }

  const { lifetime, categoryStructure, savingsStability, volatility, recurring, merchantConcentration, behavioralInsights, monthsAnalyzed } = data;

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
      <p className="mt-1 text-zinc-600">
        Long-term financial overview across {monthsAnalyzed ?? 0} months.
      </p>

      <div className="mt-6 max-w-7xl mx-auto space-y-6">
        {/* 1. Lifetime Snapshot Card */}
        <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Lifetime Snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Months analyzed</p>
              <p className="text-2xl font-bold text-gray-900">{monthsAnalyzed ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overall spend</p>
              <p className="text-2xl font-bold text-gray-900">${formatAmount(lifetime.overallSpend ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overall saving</p>
              <p className={`text-2xl font-bold ${lifetime.overallSaving != null ? (lifetime.overallSaving >= 0 ? "text-green-600" : "text-red-600") : "text-gray-900"}`}>
                {lifetime.overallSaving != null
                  ? (lifetime.overallSaving >= 0 ? "+" : "") + "$" + formatAmount(lifetime.overallSaving)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average monthly spend</p>
              <p className="text-2xl font-bold text-gray-900">${formatAmount(lifetime.avgMonthlySpend)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average savings rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {lifetime.avgSavingsRate != null ? (lifetime.avgSavingsRate >= 0 ? "+" : "") + (lifetime.avgSavingsRate * 100).toFixed(1) + "%" : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Highest spend month</p>
              <p className="text-lg font-bold text-gray-900">{getMonthLabel(lifetime.highestSpendMonth.yearMonth)}</p>
              <p className="text-sm text-gray-600">${formatAmount(lifetime.highestSpendMonth.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Lowest spend month</p>
              <p className="text-lg font-bold text-gray-900">{getMonthLabel(lifetime.lowestSpendMonth.yearMonth)}</p>
              <p className="text-sm text-gray-600">${formatAmount(lifetime.lowestSpendMonth.amount)}</p>
            </div>
          </div>
        </section>

        {/* 2. Long-Term Spending Structure */}
        {categoryStructure && categoryStructure.categoriesBySpend.length > 0 && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Long-Term Spending Structure</h2>
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-shrink-0 w-full lg:w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStructure.categoriesBySpend.map((c, i) => ({
                        name: c.category,
                        value: c.amount,
                        fill: getCategoryColor(c.category, i),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="100%"
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={1}
                    >
                      {categoryStructure.categoriesBySpend.map((c, i) => (
                        <Cell key={c.category} fill={getCategoryColor(c.category, i)} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        const name = String(item.name ?? "");
                        const value = typeof item.value === "number" ? item.value : 0;
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
                            <span className="text-sm font-medium text-gray-900">{name}: ${formatAmount(value)}</span>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {categoryStructure.categoriesBySpend.map((c, index) => (
                  <div key={c.category} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(c.category, index) }} />
                      <span className="font-medium text-gray-900">{c.category}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="font-bold text-gray-900">${formatAmount(c.amount)}</span>
                      <span className="text-sm text-gray-500 w-12 text-right">{c.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Essentials vs Discretionary (average)</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                <div
                  className="h-full flex-shrink-0 rounded-l-full bg-gradient-to-r from-blue-500 to-blue-600"
                  style={{ width: `${categoryStructure.essentialsPct}%` }}
                />
                <div
                  className="h-full flex-shrink-0 rounded-r-full bg-gradient-to-r from-purple-500 to-purple-600"
                  style={{ width: `${categoryStructure.discretionaryPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>{categoryStructure.essentialsPct.toFixed(0)}% Essential</span>
                <span>{categoryStructure.discretionaryPct.toFixed(0)}% Discretionary</span>
              </div>
            </div>
          </section>
        )}

        {/* 3. Savings Stability */}
        {savingsStability && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Savings Stability</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">Average savings rate</p>
                <p className="text-xl font-bold text-gray-900">
                  {savingsStability.avgSavingsRate != null
                    ? (savingsStability.avgSavingsRate >= 0 ? "+" : "") + (savingsStability.avgSavingsRate * 100).toFixed(1) + "%"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Savings rate std deviation</p>
                <p className="text-xl font-bold text-gray-900">{(savingsStability.savingsRateStdDev * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Months with positive savings</p>
                <p className="text-xl font-bold text-gray-900">{savingsStability.pctMonthsPositiveSavings.toFixed(0)}%</p>
              </div>
            </div>
            {savingsStability.savingsRateByMonth.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Savings rate by month (trend)</p>
                <div className="h-16 w-full">
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full text-blue-500">
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={savingsStability.savingsRateByMonth
                        .map((rate, i) => {
                          const x = (i / (savingsStability.savingsRateByMonth.length - 1 || 1)) * 100;
                          const min = Math.min(...savingsStability.savingsRateByMonth);
                          const max = Math.max(...savingsStability.savingsRateByMonth);
                          const range = max - min || 1;
                          const y = 40 - ((rate - min) / range) * 36;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  </svg>
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>{savingsStability.yearMonths[0] ? getMonthLabel(savingsStability.yearMonths[0]) : ""}</span>
                  <span>
                    {savingsStability.yearMonths.length > 0
                      ? getMonthLabel(savingsStability.yearMonths[savingsStability.yearMonths.length - 1])
                      : ""}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4. Volatility Overview */}
        {volatility && volatility.categoryVolatilities.length > 0 && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Volatility Overview</h2>
            <p className="text-sm text-gray-500 mb-4">Volatility = standard deviation / mean across months. Top 3 most volatile:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {volatility.topVolatile.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800"
                >
                  {cat}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Volatility</th>
                    <th className="pb-2 font-medium">Avg spend</th>
                  </tr>
                </thead>
                <tbody>
                  {volatility.categoryVolatilities.map((v) => (
                    <tr key={v.category} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-900">{v.category}</td>
                      <td className="py-2 pr-4 text-gray-700">{(v.volatility * 100).toFixed(1)}%</td>
                      <td className="py-2 text-gray-700">${formatAmount(v.mean)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Recurring Commitments */}
        {recurring && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-6">Recurring Commitments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">Avg monthly subscription total</p>
                <p className="text-xl font-bold text-gray-900">${formatAmount(recurring.avgMonthlySubscriptionTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Recurring merchants (≥2 consecutive months)</p>
                <p className="text-xl font-bold text-gray-900">{recurring.recurringMerchantCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Trend</p>
                <p className="text-xl font-bold text-gray-900 capitalize">{recurring.trend}</p>
              </div>
            </div>
            {recurring.recurringMerchants.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recurring.recurringMerchants.map((r) => (
                  <span
                    key={r.merchant_raw}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium bg-purple-50 text-purple-800 border border-purple-100"
                  >
                    {r.merchant_raw} <span className="ml-1 text-purple-600">({r.months} mo)</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6. Merchant Concentration */}
        {merchantConcentration && merchantConcentration.topMerchants.length > 0 && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Merchant Concentration</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Largest single merchant: {merchantConcentration.largestSingleConcentration.toFixed(1)}% of total spend.</p>
            <div className="space-y-0 divide-y divide-gray-100">
              {merchantConcentration.topMerchants.map((m, index) => (
                <div key={m.merchant_raw} className="flex items-center justify-between py-4 first:pt-0">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.merchant_raw}</p>
                      <span
                        className="inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium text-white"
                        style={{ backgroundColor: getCategoryColor(m.category, index) }}
                      >
                        {m.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">${formatAmount(m.total_spend)}</p>
                    <p className="text-xs text-gray-500">{m.percent.toFixed(1)}% of total</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. Behavioral Insights (optional) */}
        {behavioralInsights && behavioralInsights.length > 0 && (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Behavioral Insights</h2>
            <p className="text-xs text-gray-500 mb-4">Descriptive patterns from your data. Not financial advice.</p>
            <ul className="space-y-2">
              {behavioralInsights.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
