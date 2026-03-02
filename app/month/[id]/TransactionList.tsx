"use client";

import { useState, useEffect } from "react";

interface TransactionListProps {
  yearMonth: string;
  /** Increment to refetch transactions (e.g. after categorization). */
  refreshKey?: number;
}

interface TransactionRow {
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

/** Format amount: preserve sign, two decimals. Coerce string/number safely (pg returns NUMERIC as string). */
function formatAmount(amount: unknown): string {
  const n = typeof amount === "number" ? amount : typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (Number.isNaN(n)) return String(amount ?? "");
  return n < 0 ? `${n.toFixed(2)}` : n.toFixed(2);
}

export function TransactionList({ yearMonth, refreshKey = 0 }: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, month] = yearMonth.split("-").map(Number);
  const valid = !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12;

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/transactions?year=${year}&month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTransactions(data.transactions ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, valid, refreshKey]);

  if (!valid) {
    return (
      <p className="text-sm text-zinc-500">Invalid month id. Use format YYYY-MM.</p>
    );
  }

  if (loading) {
    return <p className="mt-4 text-sm text-zinc-500">Loading transactions…</p>;
  }

  if (error) {
    return (
      <p className="mt-4 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">No transactions for this month.</p>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-zinc-800">Transactions</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full border border-zinc-300 text-left text-sm">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">date</th>
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">merchant_raw</th>
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">amount</th>
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">category</th>
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">confidence</th>
              <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">exchange_rate_metadata</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-zinc-200">
                <td className="px-2 py-1.5">{t.transaction_date}</td>
                <td className="px-2 py-1.5">{t.merchant_raw}</td>
                <td className={`px-2 py-1.5 ${t.amount < 0 ? "text-red-600" : ""}`}>
                  {formatAmount(t.amount)}
                </td>
                <td className="px-2 py-1.5">{t.category ?? "—"}</td>
                <td className="px-2 py-1.5">
                  {t.confidence != null ? t.confidence.toFixed(2) : "—"}
                </td>
                <td className="px-2 py-1.5 max-w-xs truncate text-zinc-600" title={t.exchange_rate_metadata ?? undefined}>
                  {t.exchange_rate_metadata ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
