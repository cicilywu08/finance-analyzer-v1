"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CategorizationBlock } from "./CategorizationBlock";

interface InsightsData {
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
    otherBreakdown?: Array<{ category: string; amount: number }>;
  };
  volatility: {
    categoryVolatilities: Array<{ category: string; stdDev: number; mean: number }>;
    topVolatile: string[];
  };
  spikes: Array<{ category: string; current: number; rollingAvg: number; percentIncrease: number }>;
  recurring: Array<{ merchant_raw: string; months: number }>;
  topMerchants: Array<{ merchant_raw: string; total_spend: number; category: string }>;
}

function formatAmount(value: number): string {
  if (Number.isNaN(value)) return "0.00";
  return value < 0 ? value.toFixed(2) : value.toFixed(2);
}

/** Figma-style category breakdown palette — one color per category (no duplicates) */
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
/** Unique colors only for unknown categories (no overlap with above so segments never share a color) */
const FALLBACK_COLORS_BY_INDEX = [
  "#C9B1BD", "#81B29A", "#F2CC8F", "#E0AFA0", "#BC4749", "#7B68EE", "#20B2AA", "#FF7F50",
  "#9370DB", "#3CB371", "#DDA0DD", "#F0E68C", "#87CEEB", "#D2691E", "#CD5C5C", "#9ACD32",
  "#FF69B4", "#40E0D0", "#FFD700", "#778899",
];
function getCategoryColor(category: string, index: number): string {
  if (CATEGORY_CHART_COLORS[category] != null) {
    return CATEGORY_CHART_COLORS[category];
  }
  return FALLBACK_COLORS_BY_INDEX[index % FALLBACK_COLORS_BY_INDEX.length] ?? "#94a3b8";
}

interface FinancialInsightsProps {
  yearMonth: string;
  /** Increment to refetch insights (e.g. after categorization completes). */
  refreshKey?: number;
  onClassificationComplete?: () => void;
}

interface AdvisorSections {
  summary: string;
  spendingBalanceAnalysis: string;
  behavioralObservations: string;
  recommendations: string;
  forwardOutlook: string;
}

export function FinancialInsights({ yearMonth, refreshKey = 0, onClassificationComplete }: FinancialInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advisorSections, setAdvisorSections] = useState<AdvisorSections | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);

  const [year, month] = yearMonth.split("-").map(Number);
  const valid = !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12;

  const fetchInsights = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/insights?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to load insights");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, valid]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights, refreshKey]);

  const fetchAdvisorInsights = useCallback(async () => {
    if (!valid) return;
    setAdvisorLoading(true);
    setAdvisorError(null);
    try {
      const res = await fetch(`/api/advisor-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to generate advisor insights");
      }
      const json = await res.json();
      setAdvisorSections(json);
      setInsightsCollapsed(false);
    } catch (e) {
      setAdvisorError(e instanceof Error ? e.message : "Failed to generate");
      setAdvisorSections(null);
    } finally {
      setAdvisorLoading(false);
    }
  }, [year, month, valid]);

  if (!valid) return null;
  if (loading) return <p className="text-sm text-gray-500">Loading insights…</p>;
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>;
  if (!data) return null;

  const { cashFlow, categoryStructure, volatility, spikes, recurring, topMerchants } = data;
  const totalSpending = categoryStructure.essentialsTotal + categoryStructure.discretionaryTotal + categoryStructure.otherTotal;
  const essentialPct = totalSpending > 0 ? (categoryStructure.essentialsTotal / totalSpending) * 100 : 0;
  const discretionaryPct = totalSpending > 0 ? (categoryStructure.discretionaryTotal / totalSpending) * 100 : 0;
  const spendToIncomePct = cashFlow.spendToIncomeRatio != null ? cashFlow.spendToIncomeRatio * 100 : 0;
  const savingsRatePct = cashFlow.savingsRate != null ? cashFlow.savingsRate * 100 : 0;
  const cashFlowDonutColor =
    spendToIncomePct > 90 ? "#f97316" : spendToIncomePct > 75 ? "#fbbf24" : "#10b981";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Advisor Insights — full width at top (Figma) */}
      <section className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Advisor Insights</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                AI analysis of your spending structure (29 - remote, travel-oriented). Content-aware and non-judgmental.
              </p>
            </div>
          </div>

          {(!advisorSections || insightsCollapsed) && (
            <button
              type="button"
              onClick={() => (advisorSections && insightsCollapsed ? setInsightsCollapsed(false) : fetchAdvisorInsights())}
              disabled={advisorLoading}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 flex-shrink-0 inline-flex items-center gap-2"
            >
              {advisorLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : advisorSections && insightsCollapsed ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Expand insights
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Generate advisor insights
                </>
              )}
            </button>
          )}
        </div>

        {advisorError && (
          <p className="mb-4 text-sm text-red-600" role="alert">{advisorError}</p>
        )}

        {advisorSections && !insightsCollapsed && (
          <div className="space-y-6">
            {advisorSections.summary && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Summary</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{advisorSections.summary}</p>
              </div>
            )}
            {advisorSections.spendingBalanceAnalysis && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Spending balance analysis</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{advisorSections.spendingBalanceAnalysis}</p>
              </div>
            )}
            {advisorSections.behavioralObservations && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Behavioral observations</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{advisorSections.behavioralObservations}</p>
              </div>
            )}
            {advisorSections.recommendations && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Recommendations</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{advisorSections.recommendations}</p>
              </div>
            )}
            {advisorSections.forwardOutlook && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Forward outlook</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{advisorSections.forwardOutlook}</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setInsightsCollapsed(true)}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Collapse insights
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Monthly Cash Flow — left column (Figma row 2) */}
      <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Monthly Cash Flow</h3>
            <p className="text-4xl font-bold text-gray-900">${formatAmount(cashFlow.monthlyTotalSpend)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Spend</p>
          </div>
          {cashFlow.income != null && cashFlow.income > 0 && (
            <div className="relative w-32 h-32 flex-shrink-0">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(${cashFlowDonutColor} 0% ${Math.min(spendToIncomePct, 100)}%, #f3f4f6 ${Math.min(spendToIncomePct, 100)}% 100%)`,
                }}
              />
              <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none" style={{ color: cashFlowDonutColor }}>
                  {spendToIncomePct.toFixed(0)}%
                </span>
                <span className="text-xs text-gray-500 mt-1">of income</span>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-9c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-blue-900">Income</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {cashFlow.income != null ? `$${formatAmount(cashFlow.income)}` : "—"}
            </p>
          </div>
          <div
            className={`rounded-2xl p-4 ${
              savingsRatePct >= 0
                ? "bg-gradient-to-br from-green-50 to-green-100/50"
                : "bg-gradient-to-br from-red-50 to-red-100/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {savingsRatePct >= 0 ? (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              )}
              <span className={`text-xs font-medium ${savingsRatePct >= 0 ? "text-green-900" : "text-red-900"}`}>
                Savings Rate
              </span>
            </div>
            <p className={`text-2xl font-bold ${savingsRatePct >= 0 ? "text-green-900" : "text-red-900"}`}>
              {cashFlow.savingsRate != null ? (savingsRatePct >= 0 ? "+" : "") + savingsRatePct.toFixed(1) + "%" : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* 2b. Spending Spikes — right column same row as Cash Flow (Figma) */}
      {spikes.length > 0 ? (
        <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Spending Spikes</h3>
          </div>
          <div className="space-y-6">
            {spikes.map((s) => (
              <div
                key={s.category}
                className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{s.category}</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100">
                        <svg className="w-3 h-3 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-xs font-medium text-amber-700">
                          +{s.percentIncrease.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">vs 3-month average</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. Category Breakdown — left column (Figma: donut + legend + Spending Type) */}
      <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Category Breakdown</h3>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Donut chart (Recharts) with fixed category colors and hover tooltip */}
          {categoryStructure.categoriesBySpend.length > 0 && (
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
                      const name = item.name ?? "";
                      const value = typeof item.value === "number" ? item.value : 0;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
                          <span className="text-sm font-medium text-gray-900">
                            {name}: ${formatAmount(value)}
                          </span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Category list */}
          <div className="flex-1 space-y-3">
            {categoryStructure.categoriesBySpend.map((c, index) => (
              <div
                key={c.category}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(c.category, index) }}
                  />
                  <span className="font-medium text-gray-900">{c.category}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-bold text-gray-900">${formatAmount(c.amount)}</span>
                  <span className="text-sm text-gray-500 w-12 text-right">
                    {c.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Spending Type bar (Figma: inside Category Breakdown card) */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">Spending Type</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            <div
              className="h-full flex-shrink-0 rounded-l-full bg-gradient-to-r from-blue-500 to-blue-600"
              style={{ width: `${essentialPct}%` }}
            />
            <div
              className="h-full flex-shrink-0 rounded-r-full bg-gradient-to-r from-purple-500 to-purple-600"
              style={{ width: `${discretionaryPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>{essentialPct.toFixed(0)}% Essential</span>
            <span>{discretionaryPct.toFixed(0)}% Discretionary</span>
          </div>
        </div>
        {categoryStructure.otherTotal !== 0 && (
          <p className="mt-4 text-xs text-gray-500">Other (fees, cash, uncategorized): {formatAmount(categoryStructure.otherTotal)}</p>
        )}
        {volatility.topVolatile.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
            <span className="font-medium text-amber-800">Top volatile categories</span>
            {" "}(past 3–6 months): {volatility.topVolatile.join(", ")}
          </div>
        )}
      </section>

      {/* 3. Top Merchants — right column next to Category Breakdown (Figma) */}
      {topMerchants.length > 0 ? (
        <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">Top Merchants</h3>
          </div>
          <div className="space-y-0 divide-y divide-gray-100">
            {topMerchants.map((m, index) => {
              const categoryColor = getCategoryColor(m.category, index);
              return (
                <div
                  key={m.merchant_raw}
                  className="flex items-center justify-between py-4 first:pt-0"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.merchant_raw}</p>
                      <span
                        className="inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium text-white"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {m.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">${formatAmount(m.total_spend)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. Category Summary (Run categorization + table) — left column below Category Breakdown (Figma) */}
      <div className="contents">
        <CategorizationBlock
          yearMonth={yearMonth}
          onClassificationComplete={onClassificationComplete}
        />
      </div>
      {/* Empty cell to align grid when Top Merchants is present */}
      {topMerchants.length > 0 ? <div className="hidden lg:block" aria-hidden /> : null}

      {/* 5. Recurring Subscriptions — full width (Figma) */}
      {recurring.length > 0 && (
        <section className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Recurring Subscriptions</h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500">Recurring</p>
              <p className="text-xl font-bold text-purple-600">{recurring.length} merchant{recurring.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurring.map((r) => (
              <div
                key={r.merchant_raw}
                className="rounded-xl bg-purple-50/80 p-4 border border-purple-100/80"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.merchant_raw}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{r.months} month{r.months !== 1 ? "s" : ""} recurring</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
