"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/LanguageContext";

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return yearMonth;
  const date = new Date(y, m - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface MonthPageHeaderProps {
  yearMonth: string;
  monthLabel: string;
  switcherMonths: string[];
}

export function MonthPageHeader({ yearMonth, monthLabel, switcherMonths }: MonthPageHeaderProps) {
  const { t } = useTranslations();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/month/${yearMonth}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Delete failed");
      }
      setConfirmOpen(false);
      router.push("/months");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/months"
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Back to months"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t("month.dashboard_title")}
              </h1>
              <p className="text-sm text-gray-500">{monthLabel} {t("month.overview")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              aria-label={t("month.delete_month")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t("month.delete_month")}
            </button>
            <Link
              href="#transactions"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("month.view_transactions")}
            </Link>
          </div>
        </div>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="mx-4 max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-gray-800 mb-6">{t("month.delete_confirm")}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("month.delete_cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "…" : t("month.delete_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
      {switcherMonths.length > 0 && (
        <div className="px-6 pb-4 flex items-center justify-center gap-3 flex-wrap">
          {switcherMonths.map((ym) => {
            const isActive = ym === yearMonth;
            const label = getMonthLabel(ym);
            return (
              <Link
                key={ym}
                href={`/month/${ym}`}
                className={
                  isActive
                    ? "rounded-full px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-md hover:from-blue-700 hover:to-purple-700 transition-colors"
                    : "rounded-full px-5 py-2.5 text-sm font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
