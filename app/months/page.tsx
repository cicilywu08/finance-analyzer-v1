"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/LanguageContext";

export default function MonthsPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [months, setMonths] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMonths = async () => {
    setFetchError(null);
    try {
      const res = await fetch("/api/months", { cache: "no-store" });
      const json = await res.json();
      // Debug: log response so we can see why months might be empty
      console.log("[dashboard /api/months] status", res.status, "body", json);
      const list = Array.isArray(json?.months) ? json.months : [];
      setMonths(list);
      if (!res.ok) {
        setFetchError(json?.error ?? `Request failed (${res.status})`);
        return;
      }
      if (list.length > 0) {
        router.replace(`/month/${list[0]}`);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      console.log("[dashboard /api/months] error", msg);
      setMonths([]);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonths();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("months.dashboard")}</h1>
        <p className="mt-4 text-zinc-500">{t("months.loading")}</p>
      </div>
    );
  }

  if (months && months.length > 0) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("months.dashboard")}</h1>
        <p className="mt-4 text-zinc-500">{t("months.redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("months.dashboard")}</h1>
      {fetchError ? (
        <>
          <p className="mt-4 text-red-600 font-medium" role="alert">
            Could not load months: {fetchError}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Check the browser console for /api/months response (status, body).
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchMonths();
            }}
            className="mt-4 rounded-xl bg-red-100 hover:bg-red-200 px-4 py-2 text-sm font-medium text-red-800 transition-colors"
          >
            {t("common.retry")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-zinc-600">
            {t("months.no_months")}{" "}
            <Link href="/upload" className="text-blue-600 hover:underline">
              {t("months.upload_page")}
            </Link>{" "}
            {t("months.to_get_started")}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchMonths();
            }}
            className="mt-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors"
          >
            {t("common.refresh")}
          </button>
        </>
      )}
    </div>
  );
}
