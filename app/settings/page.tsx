"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/components/LanguageContext";

type Defaults = { rent: number | null; income: number | null };
type OverrideEntry = { rent: number | null; income: number | null };

function toNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

export default function SettingsPage() {
  const { t } = useTranslations();
  const [defaults, setDefaults] = useState<Defaults>({ rent: null, income: null });
  const [overrides, setOverrides] = useState<Map<string, OverrideEntry>>(new Map());
  const [statementMonths, setStatementMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t("settings.failed_to_load"));
      setDefaults({
        rent: data.defaults?.rent ?? null,
        income: data.defaults?.income ?? null,
      });
      const map = new Map<string, OverrideEntry>();
      for (const ym of data.statementMonths ?? []) {
        const o = (data.overrides ?? []).find(
          (r: { year: number; month: number }) => `${r.year}-${String(r.month).padStart(2, "0")}` === ym
        );
        map.set(ym, o ? { rent: o.rent ?? null, income: o.income ?? null } : { rent: null, income: null });
      }
      setOverrides(map);
      setStatementMonths(data.statementMonths ?? []);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("settings.failed_to_load") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const setDefault = (key: "rent" | "income", value: number | null) => {
    setDefaults((d) => ({ ...d, [key]: value }));
  };

  const setOverride = (ym: string, key: "rent" | "income", value: number | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const cur = next.get(ym) ?? { rent: null, income: null };
      next.set(ym, { ...cur, [key]: value });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const overridesPayload = statementMonths.map((ym) => {
        const [y, m] = ym.split("-").map(Number);
        const o = overrides.get(ym) ?? { rent: null, income: null };
        return { year: y, month: m, rent: o.rent, income: o.income };
      });
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaults: { rent: defaults.rent, income: defaults.income },
          overrides: overridesPayload,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? t("settings.save_failed"));
      }
      setMessage({ type: "ok", text: t("settings.saved") });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("settings.save_failed") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold">{t("settings.page_title")}</h1>
        <p className="mt-4 text-zinc-500">{t("settings.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.page_title")}</h1>
      <p className="mt-1 text-zinc-600">{t("settings.subtitle")}</p>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("settings.defaults")}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{t("settings.defaults_hint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">{t("settings.monthly_rent")}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 2000"
              className="w-32 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              value={defaults.rent ?? ""}
              onChange={(e) => setDefault("rent", toNum(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">Monthly after-tax income</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 6000"
              className="w-32 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              value={defaults.income ?? ""}
              onChange={(e) => setDefault("income", toNum(e.target.value))}
            />
          </label>
        </div>
      </section>

      {statementMonths.length > 0 && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("settings.overrides_title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t("settings.overrides_hint")}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600 dark:border-zinc-600">
                  <th className="pb-2 pr-4 font-medium">{t("settings.month")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("settings.rent")}</th>
                  <th className="pb-2 font-medium">{t("settings.income")}</th>
                </tr>
              </thead>
              <tbody>
                {statementMonths.map((ym) => {
                  const o = overrides.get(ym) ?? { rent: null, income: null };
                  return (
                    <tr key={ym} className="border-b border-zinc-100 dark:border-zinc-700">
                      <td className="py-2 pr-4 font-medium">{ym}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={t("settings.placeholder_default")}
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                          value={o.rent ?? ""}
                          onChange={(e) => setOverride(ym, "rent", toNum(e.target.value))}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={t("settings.placeholder_default")}
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                          value={o.income ?? ""}
                          onChange={(e) => setOverride(ym, "income", toNum(e.target.value))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? t("settings.saving") : t("settings.save_all")}
        </button>
        {message && (
          <span
            className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
            role="status"
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
