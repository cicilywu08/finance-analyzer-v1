"use client";

import { useState, useEffect, useCallback } from "react";

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
  topMerchants: Array<{ merchant_raw: string; total_spend: number }>;
}

function formatAmount(value: number): string {
  if (Number.isNaN(value)) return "0.00";
  return value < 0 ? value.toFixed(2) : value.toFixed(2);
}

interface FinancialInsightsProps {
  yearMonth: string;
  /** Increment to refetch insights (e.g. after categorization completes). */
  refreshKey?: number;
}

interface AdvisorSections {
  summary: string;
  spendingBalanceAnalysis: string;
  behavioralObservations: string;
  recommendations: string;
  forwardOutlook: string;
}

export function FinancialInsights({ yearMonth, refreshKey = 0 }: FinancialInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advisorSections, setAdvisorSections] = useState<AdvisorSections | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

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
    } catch (e) {
      setAdvisorError(e instanceof Error ? e.message : "Failed to generate");
      setAdvisorSections(null);
    } finally {
      setAdvisorLoading(false);
    }
  }, [year, month, valid]);

  if (!valid) return null;
  if (loading) return <p className="mt-6 text-sm text-zinc-500">Loading insights…</p>;
  if (error) return <p className="mt-6 text-sm text-red-600" role="alert">{error}</p>;
  if (!data) return null;

  const { cashFlow, categoryStructure, volatility, spikes, recurring, topMerchants } = data;

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Financial indicators &amp; insights
      </h2>

      {/* A. Cash Flow Overview */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cash flow overview</h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <span className="text-zinc-600 dark:text-zinc-400">Monthly total spend</span>
            {" "}(credit card + rent): <span className="font-medium">{formatAmount(cashFlow.monthlyTotalSpend)}</span>
          </li>
          <li>
            <span className="text-zinc-600 dark:text-zinc-400">Spend-to-income ratio</span>
            {" "}(total spend / income):{" "}
            {cashFlow.spendToIncomeRatio != null ? (
              <span className="font-medium">{(cashFlow.spendToIncomeRatio * 100).toFixed(1)}%</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </li>
          <li>
            <span className="text-zinc-600 dark:text-zinc-400">Estimated savings rate</span>
            {" "}(1 − spend/income):{" "}
            {cashFlow.savingsRate != null ? (
              <span className="font-medium">{(cashFlow.savingsRate * 100).toFixed(1)}%</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </li>
        </ul>
      </section>

      {/* B. Category structure: Essentials vs Discretionary + volatility */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category structure</h3>
        <p className="mt-0.5 text-xs text-zinc-500">All categories sorted by spend. Essentials vs discretionary.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-zinc-500">Essentials (rent, groceries, transport, health, bills)</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formatAmount(categoryStructure.essentialsTotal)}</p>
            {categoryStructure.essentialsBreakdown.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                {categoryStructure.essentialsBreakdown.map((r) => (
                  <li key={r.category}>{r.category}: {formatAmount(r.amount)}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Discretionary (dining, entertainment, shopping, travel, subscriptions)</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formatAmount(categoryStructure.discretionaryTotal)}</p>
            {categoryStructure.discretionaryBreakdown.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                {categoryStructure.discretionaryBreakdown.map((r) => (
                  <li key={r.category}>{r.category}: {formatAmount(r.amount)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {categoryStructure.otherTotal !== 0 && (
          <p className="mt-2 text-xs text-zinc-500">Other (fees, cash, uncategorized): {formatAmount(categoryStructure.otherTotal)}</p>
        )}
        {volatility.topVolatile.length > 0 && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50/50 p-2 text-sm dark:border-amber-800 dark:bg-amber-900/20">
            <span className="font-medium text-amber-800 dark:text-amber-200">Top 2 most volatile categories</span>
            {" "}(past 3–6 months): {volatility.topVolatile.join(", ")}
          </div>
        )}
      </section>

      {/* C. Behavioral: Spikes, Recurring, Top merchants */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Behavioral insights</h3>

        {spikes.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-500">Largest spikes (current vs 3‑month rolling average, &gt;20% increase)</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {spikes.map((s) => (
                <li key={s.category}>
                  <span className="font-medium">{s.category}</span>: {formatAmount(s.current)} vs avg {formatAmount(s.rollingAvg)}
                  {" "}(<span className="text-amber-700 dark:text-amber-400">+{s.percentIncrease.toFixed(0)}%</span>)
                </li>
              ))}
            </ul>
          </div>
        )}

        {recurring.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-500">Recurring (merchant in ≥2 consecutive months)</p>
            <ul className="mt-1 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
              {recurring.map((r) => (
                <li key={r.merchant_raw}>{r.merchant_raw} ({r.months} months)</li>
              ))}
            </ul>
          </div>
        )}

        {topMerchants.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-500">Top 5 merchants by spend</p>
            <ol className="mt-1 list-inside list-decimal text-sm text-zinc-700 dark:text-zinc-300">
              {topMerchants.map((m) => (
                <li key={m.merchant_raw}>{m.merchant_raw}: {formatAmount(m.total_spend)}</li>
              ))}
            </ol>
          </div>
        )}

        {spikes.length === 0 && recurring.length === 0 && topMerchants.length === 0 && (
          <p className="mt-2 text-xs text-zinc-500">No spikes, recurring subscriptions, or merchant data for this month.</p>
        )}
      </section>

      {/* D. Advisor insights (LLM) */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Advisor insights</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          AI analysis of your spending structure (29, remote, travel-oriented). Context-aware and non-judgmental.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={fetchAdvisorInsights}
            disabled={advisorLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {advisorLoading ? "Generating…" : "Generate advisor insights"}
          </button>
          {advisorError && (
            <p className="mt-2 text-sm text-red-600" role="alert">{advisorError}</p>
          )}
          {advisorSections && (
            <div className="mt-4 space-y-4 text-sm">
              {advisorSections.summary && (
                <div>
                  <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Summary</h4>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{advisorSections.summary}</p>
                </div>
              )}
              {advisorSections.spendingBalanceAnalysis && (
                <div>
                  <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Spending balance analysis</h4>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{advisorSections.spendingBalanceAnalysis}</p>
                </div>
              )}
              {advisorSections.behavioralObservations && (
                <div>
                  <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Behavioral observations</h4>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{advisorSections.behavioralObservations}</p>
                </div>
              )}
              {advisorSections.recommendations && (
                <div>
                  <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Recommendations</h4>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{advisorSections.recommendations}</p>
                </div>
              )}
              {advisorSections.forwardOutlook && (
                <div>
                  <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Forward outlook</h4>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{advisorSections.forwardOutlook}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
