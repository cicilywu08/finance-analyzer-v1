"use client";

import { useState, useEffect, useCallback } from "react";

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

  const fetchBreakdown = useCallback(async () => {
    if (!valid) return;
    setError(null);
    try {
      const res = await fetch(`/api/classify?year=${year}&month=${month}`);
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

  const runCategorization = async () => {
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
  };

  if (!valid) {
    return (
      <p className="text-sm text-zinc-500">Invalid month id. Use format YYYY-MM.</p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={runCategorization}
          disabled={classifying}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
        >
          {classifying ? "Running…" : "Run categorization"}
        </button>
        {lowConfidenceCount > 0 && (
          <span className="text-sm text-amber-700">
            Low confidence: {lowConfidenceCount} transaction(s)
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {(rent != null || income != null || totalSpend !== null || netSpendTotal !== null || totalCredits !== null) && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/30">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium text-zinc-800 dark:text-zinc-200">
            {income != null && <span>Income: {formatAmount(income)}</span>}
            {rent != null && <span>Rent: {formatAmount(rent)}</span>}
            {totalSpend !== null && <span>Spend: {formatAmount(totalSpend)}</span>}
            {totalCredits !== null && totalCredits < 0 && (
              <span className="text-red-600">Credits: {formatAmount(totalCredits)}</span>
            )}
            {netSpendTotal !== null && <span className="text-zinc-500">Statement net: {formatAmount(netSpendTotal)}</span>}
          </div>
          {income != null && rent != null && totalSpend !== null && (
            <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">
              After rent &amp; spend: Income − Rent − Spend ={" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatAmount(income - rent - totalSpend)}
              </span>
              {income > 0 && (
                <>
                  {" "}
                  <span className="text-zinc-500">
                    (rent + spend = {((rent + totalSpend) / income * 100).toFixed(1)}% of income)
                  </span>
                  {" "}
                  <span className="text-zinc-500">
                    Saving rate: {(((income - rent - totalSpend) / income) * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading breakdown…</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-zinc-300 text-left text-sm">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border-b border-zinc-300 px-3 py-2 font-medium">category</th>
                <th className="border-b border-zinc-300 px-3 py-2 font-medium">totalAmount</th>
                <th className="border-b border-zinc-300 px-3 py-2 font-medium">percent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-200">
                  <td className="px-3 py-2">{r.category}</td>
                  <td className={`px-3 py-2 ${parseFloat(r.total_amount) < 0 ? "text-red-600" : ""}`}>
                    {formatAmount(r.total_amount)}
                  </td>
                  <td className="px-3 py-2">{r.percent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No transactions for this month, or run categorization first.</p>
      )}
    </div>
  );
}
