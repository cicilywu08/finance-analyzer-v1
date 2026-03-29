"use client";

import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/components/LanguageContext";

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

function ConfidenceCell({ confidence }: { confidence: number | null }) {
  if (confidence == null) return <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>;
  if (confidence >= 0.8) {
    return (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {confidence.toFixed(2)}
      </td>
    );
  }
  return (
    <td className="px-6 py-4 whitespace-nowrap text-sm">
      <div className="flex items-center gap-1.5 text-amber-600">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs font-medium">{confidence.toFixed(2)}</span>
      </div>
    </td>
  );
}

export function TransactionList({ yearMonth, refreshKey = 0 }: TransactionListProps) {
  const { t, categoryLabel } = useLanguage();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
    fetch(`/api/transactions?year=${year}&month=${month}`, { cache: "no-store" })
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

  const categories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        !searchQuery.trim() ||
        t.merchant_raw.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || (t.category ?? "") === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, searchQuery, selectedCategory]);

  if (!valid) {
    return (
      <p className="text-sm text-gray-500">{t("month.invalid_month_id")}</p>
    );
  }

  if (loading) {
    return <p className="text-sm text-gray-500">{t("month.loading_tx")}</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters — matches Figma transactions-screen */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("month.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/80 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-48 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t("month.all_categories")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table — matches Figma styling */}
      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">{t("month.no_tx_this_month")}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-sm">{t("month.no_tx_match_filters")}</p>
          </div>
        ) : (
          <>
            <p className="px-6 py-3 text-sm text-gray-500 border-b border-gray-100">
              {filteredTransactions.length} {filteredTransactions.length !== 1 ? t("month.transactions") : t("month.transaction")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("month.date")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("month.merchant")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("month.amount")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("month.category")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("month.confidence")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {t.transaction_date}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {t.merchant_raw}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        <span className={t.amount < 0 ? "text-red-600" : ""}>
                          {formatAmount(t.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {categoryLabel(t.category)}
                      </td>
                      <ConfidenceCell confidence={t.confidence} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
