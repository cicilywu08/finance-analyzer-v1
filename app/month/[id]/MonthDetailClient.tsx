"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "@/components/LanguageContext";
import { FinancialInsights } from "./FinancialInsights";
import { TransactionList } from "./TransactionList";

interface MonthDetailClientProps {
  yearMonth: string;
}

export function MonthDetailClient({ yearMonth }: MonthDetailClientProps) {
  const { t } = useTranslations();
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [classifying, setClassifying] = useState(false);
  const [y, m] = yearMonth.split("-").map(Number);
  const validMonth = !isNaN(y) && !isNaN(m) && m >= 1 && m <= 12;

  const runCategorization = useCallback(async () => {
    if (!validMonth) return;
    setClassifying(true);
    try {
      const res = await fetch(`/api/classify?year=${y}&month=${m}`, { method: "POST" });
      if (!res.ok) throw new Error("Classification failed");
      setDataRefreshKey((k) => k + 1);
    } catch {
      // Error surfaced in CategorizationBlock / refetch will show state
    } finally {
      setClassifying(false);
    }
  }, [y, m, validMonth]);

  return (
    <div className="space-y-6">
      {/* Prominent Run categorization bar — easy to find without opening cards */}
      {validMonth && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-700">
              {t("month.categorize_hint")}
            </p>
            <button
              type="button"
              onClick={runCategorization}
              disabled={classifying}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {classifying ? t("month.categorization_running") : t("month.run_categorization")}
            </button>
          </div>
          {classifying && (
            <p
              className="mt-3 text-sm text-blue-900 bg-white/70 border border-blue-200 rounded-xl px-3 py-2.5"
              role="status"
              aria-live="polite"
            >
              {t("month.categorization_wait")}
            </p>
          )}
        </div>
      )}

      <FinancialInsights
        yearMonth={yearMonth}
        refreshKey={dataRefreshKey}
        onClassificationComplete={() => setDataRefreshKey((k) => k + 1)}
      />
      <div id="transactions">
        <TransactionList yearMonth={yearMonth} refreshKey={dataRefreshKey} />
      </div>
    </div>
  );
}
