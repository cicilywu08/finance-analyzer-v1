"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/components/LanguageContext";

interface CategorizationBlockProps {
  yearMonth: string;
  onClassificationComplete?: () => void;
}

interface BreakdownRow {
  category: string;
  total_amount: string;
  percent: number;
}

/** Format amount for display: preserve sign, two decimals. */
function formatAmount(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n < 0 ? `${n.toFixed(2)}` : n.toFixed(2);
}

export function CategorizationBlock({ yearMonth, onClassificationComplete }: CategorizationBlockProps) {
  const { t, categoryLabel } = useLanguage();
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [lowConfidenceCount, setLowConfidenceCount] = useState<number>(0);
  const [totalSpend, setTotalSpend] = useState<number | null>(null);
  const [netSpendTotal, setNetSpendTotal] = useState<number | null>(null);
  const [totalCredits, setTotalCredits] = useState<number | null>(null);
  const [rent, setRent] = useState<number | null>(null);
  const [income, setIncome] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, month] = yearMonth.split("-").map(Number);
  const valid = !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12;
  const hasAutoRunRef = useRef(false);

  const fetchBreakdown = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classify?year=${year}&month=${month}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      const data = await res.json();
      setRows(data.rows ?? []);
      setLowConfidenceCount(data.lowConfidenceCount ?? 0);
      setTotalSpend(typeof data.totalSpend === "number" ? data.totalSpend : null);
      setNetSpendTotal(typeof data.netSpendTotal === "number" ? data.netSpendTotal : null);
      setTotalCredits(typeof data.totalCredits === "number" ? data.totalCredits : null);
      setRent(data.rent != null ? data.rent : null);
      setIncome(data.income != null ? data.income : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setLowConfidenceCount(0);
      setTotalSpend(null);
      setNetSpendTotal(null);
      setTotalCredits(null);
      setRent(null);
      setIncome(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, valid]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  const runCategorization = useCallback(async () => {
    if (!valid) return;
    setClassifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/classify?year=${year}&month=${month}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      await fetchBreakdown();
      onClassificationComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed");
    } finally {
      setClassifying(false);
    }
  }, [year, month, valid, fetchBreakdown, onClassificationComplete]);

  // Auto-run categorization once when this month has only "Uncategorized" (e.g. fresh upload).
  useEffect(() => {
    if (loading || classifying || !valid || hasAutoRunRef.current) return;
    if (rows.length !== 1 || rows[0]?.category !== "Uncategorized") return;
    const hasSpend = totalSpend != null && totalSpend > 0;
    const hasNet = netSpendTotal != null && Math.abs(netSpendTotal) > 0.01;
    if (!hasSpend && !hasNet) return;
    hasAutoRunRef.current = true;
    runCategorization();
  }, [loading, classifying, valid, rows, totalSpend, netSpendTotal, runCategorization]);

  if (!valid) {
    return (
      <p className="text-sm text-zinc-500">{t("month.invalid_month_id")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        {classifying && (
          <p
            className="mb-4 text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            {t("month.categorization_wait")}
          </p>
        )}
        {lowConfidenceCount > 0 && (
          <p className="text-sm text-amber-700 font-medium mb-4">
            {t("month.low_confidence")}: {lowConfidenceCount} transaction(s)
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {(rent != null || income != null || totalSpend !== null || netSpendTotal !== null || totalCredits !== null) && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium text-gray-800">
            {income != null && <span>Income: {formatAmount(income)}</span>}
            {rent != null && <span>Rent: {formatAmount(rent)}</span>}
            {totalSpend !== null && <span>Spend: {formatAmount(totalSpend)}</span>}
            {totalCredits !== null && totalCredits < 0 && (
              <span className="text-red-600">{t("month.credits")}: {formatAmount(totalCredits)}</span>
            )}
            {netSpendTotal !== null && <span className="text-gray-500">{t("month.statement_net")}: {formatAmount(netSpendTotal)}</span>}
          </div>
          {income != null && rent != null && totalSpend !== null && (
            <p className="mt-1.5 text-gray-600">
              After rent &amp; spend: Income − Rent − Spend ={" "}
              <span className="font-medium text-gray-900">
                {formatAmount(income - rent - totalSpend)}
              </span>
              {income > 0 && (
                <>
                  {" "}
                  <span className="text-gray-500">
                    (rent + spend = {((rent + totalSpend) / income * 100).toFixed(1)}% of income)
                  </span>
                  {" "}
                  <span className="text-gray-500">
                    Saving rate: {(((income - rent - totalSpend) / income) * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-gray-500">{t("month.loading_breakdown")}</p>
        ) : rows.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-medium text-gray-600">{t("month.category_summary")}</h3>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      CATEGORY
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      TOTAL AMOUNT
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      PERCENT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{categoryLabel(r.category)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${parseFloat(r.total_amount) < 0 ? "text-red-600" : "text-gray-900"}`}>
                        {parseFloat(r.total_amount) < 0 ? "-$" + formatAmount(-parseFloat(r.total_amount)) : "$" + formatAmount(r.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {r.percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {rows.length > 0 && totalSpend != null && (
                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                      <td className="px-4 py-3 text-sm text-gray-900">{t("month.total")}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        ${formatAmount(totalSpend)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">100.0%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">{t("month.no_tx_or_run_cat")}</p>
        )}
      </div>
    </div>
  );
}
