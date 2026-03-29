"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/components/LanguageContext";

const FIRE_STORAGE_KEY = "fire-calculator-state";

type TaxMode = "ignore" | "basic";

interface SensitivityItem {
  labelKey: string;
  valueKey: string;
  valueParam?: string;
  explainKey: string;
}

interface FireResults {
  fireNumber: number;
  yearsToTarget: number;
  requiredMonthlySavings: number;
  onTrack: boolean;
  projectedAssetsAtTarget: number;
  annualizedSpend: number;
  annualRetirementSpend: number;
  savingsRate: number | null;
  emergencyFundMonths: number | null;
  spendVolatilityNoteKey?: string | null;
  spendVolatilityNote?: string | null; // legacy
  sensitivity: (SensitivityItem | { label: string; value: string })[];
}

interface SavedFireState {
  inputs: {
    currentAge: number | "";
    targetFireAge: number | "";
    taxMode: TaxMode;
    investableAssets: number | "";
    emergencyFund: number | "";
    oneTimeInflow: number | "";
    annualIncome: number | "";
    monthlySavings: number | "";
    incomeGrowthPct: number;
    baselineMonthlySpend: number | "";
    retirementMultiplier: number;
    inflationPct: number;
    swrPct: number;
    investmentReturnPct: number;
  };
  fromAppData: { baselineSpend: boolean; income: boolean };
  hasCalculated: boolean;
  results: FireResults | null;
}

function formatCurrency(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  return n.toFixed(1) + "%";
}

/** Future value of portfolio: FV = PV*(1+r)^n + PMT * (((1+r)^n - 1) / r). Monthly compounding. */
function futureValue(pv: number, monthlyRate: number, nMonths: number, pmt: number): number {
  if (nMonths <= 0) return pv;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  if (Math.abs(monthlyRate) < 1e-9) return pv + pmt * nMonths;
  return pv * factor + pmt * ((factor - 1) / monthlyRate);
}

/** Solve for monthly PMT so that FV >= target. */
function requiredMonthlySavings(pv: number, target: number, monthlyRate: number, nMonths: number): number {
  if (nMonths <= 0) return target > pv ? target - pv : 0;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  if (Math.abs(monthlyRate) < 1e-9) return Math.max(0, (target - pv) / nMonths);
  const needFromContrib = target - pv * factor;
  if (needFromContrib <= 0) return 0;
  return needFromContrib / ((factor - 1) / monthlyRate);
}

export default function FireCalculatorPage() {
  const { t } = useTranslations();
  const [summaryData, setSummaryData] = useState<{
    avgMonthlySpend?: number;
    savingsRateStdDev?: number;
    monthsAnalyzed?: number;
  } | null>(null);
  const [settingsData, setSettingsData] = useState<{ defaults: { income: number | null } } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [currentAge, setCurrentAge] = useState<number | "">("");
  const [targetFireAge, setTargetFireAge] = useState<number | "">("");
  const [taxMode, setTaxMode] = useState<TaxMode>("ignore");
  const [investableAssets, setInvestableAssets] = useState<number | "">("");
  const [emergencyFund, setEmergencyFund] = useState<number | "">("");
  const [oneTimeInflow, setOneTimeInflow] = useState<number | "">("");
  const [annualIncome, setAnnualIncome] = useState<number | "">("");
  const [monthlySavings, setMonthlySavings] = useState<number | "">("");
  const [incomeGrowthPct, setIncomeGrowthPct] = useState<number>(2);
  const [baselineMonthlySpend, setBaselineMonthlySpend] = useState<number | "">("");
  const [retirementMultiplier, setRetirementMultiplier] = useState<number>(1);
  const [inflationPct, setInflationPct] = useState<number>(2.5);
  const [swrPct, setSwrPct] = useState<number>(4);
  const [investmentReturnPct, setInvestmentReturnPct] = useState<number>(6.5);

  const [fromAppData, setFromAppData] = useState({ baselineSpend: false, income: false });
  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<FireResults | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/summary", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([summary, settings]) => {
        if (cancelled) return;
        if (summary?.lifetime) {
          setSummaryData({
            avgMonthlySpend: summary.lifetime.avgMonthlySpend,
            savingsRateStdDev: summary.savingsStability?.savingsRateStdDev,
            monthsAnalyzed: summary.monthsAnalyzed,
          });
          setBaselineMonthlySpend(summary.lifetime.avgMonthlySpend ?? "");
          setFromAppData((p) => ({ ...p, baselineSpend: true }));
        } else {
          setSummaryData(null);
        }
        const monthlyIncome = settings?.defaults?.income;
        if (monthlyIncome != null && monthlyIncome > 0) {
          setSettingsData(settings);
          setAnnualIncome(monthlyIncome * 12);
          setFromAppData((p) => ({ ...p, income: true }));
        } else {
          setSettingsData(null);
        }

        try {
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(FIRE_STORAGE_KEY) : null;
          const saved: SavedFireState | null = raw ? JSON.parse(raw) : null;
          if (saved?.inputs && !cancelled) {
            const i = saved.inputs;
            setCurrentAge(i.currentAge);
            setTargetFireAge(i.targetFireAge);
            setTaxMode(i.taxMode);
            setInvestableAssets(i.investableAssets);
            setEmergencyFund(i.emergencyFund);
            setOneTimeInflow(i.oneTimeInflow);
            setAnnualIncome(i.annualIncome);
            setMonthlySavings(i.monthlySavings);
            setIncomeGrowthPct(i.incomeGrowthPct);
            setBaselineMonthlySpend(i.baselineMonthlySpend);
            setRetirementMultiplier(i.retirementMultiplier);
            setInflationPct(i.inflationPct);
            setSwrPct(i.swrPct);
            setInvestmentReturnPct(i.investmentReturnPct);
            setFromAppData(saved.fromAppData);
            setHasCalculated(!!saved.hasCalculated);
            setResults(saved.results ?? null);
            setHasUnsavedChanges(false);
          }
        } catch {
          // ignore invalid saved state
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const runCalculation = useCallback(() => {
    const age = typeof currentAge === "number" ? currentAge : parseInt(String(currentAge), 10);
    const tAge = typeof targetFireAge === "number" ? targetFireAge : parseInt(String(targetFireAge), 10);
    const assets = typeof investableAssets === "number" ? investableAssets : parseFloat(String(investableAssets));
    const baseline = typeof baselineMonthlySpend === "number" ? baselineMonthlySpend : parseFloat(String(baselineMonthlySpend));
    const annual = typeof annualIncome === "number" ? annualIncome : parseFloat(String(annualIncome));
    const currentSavings = typeof monthlySavings === "number" ? monthlySavings : (monthlySavings === "" ? null : parseFloat(String(monthlySavings)));
    const emergency = typeof emergencyFund === "number" ? emergencyFund : (emergencyFund === "" ? 0 : parseFloat(String(emergencyFund)));
    const inflow = typeof oneTimeInflow === "number" ? oneTimeInflow : (oneTimeInflow === "" ? 0 : parseFloat(String(oneTimeInflow)));

    if (Number.isNaN(age) || Number.isNaN(tAge) || Number.isNaN(assets) || Number.isNaN(baseline) || baseline <= 0 || tAge <= age) {
      setResults(null);
      return;
    }

    const annualizedSpend = baseline * 12;
    const annualRetirementSpend = annualizedSpend * retirementMultiplier;
    const fireNumber = annualRetirementSpend / (swrPct / 100);
    const yearsToTarget = tAge - age;
    const nMonths = yearsToTarget * 12;
    const monthlyRate = Math.pow(1 + investmentReturnPct / 100, 1 / 12) - 1;
    const pv = assets + (inflow || 0);
    const required = requiredMonthlySavings(pv, fireNumber, monthlyRate, nMonths);
    const currentPmt = currentSavings ?? (Number.isFinite(annual) && annual > 0 ? Math.max(0, annual / 12 - baseline) : 0);
    const projectedAssets = futureValue(pv, monthlyRate, nMonths, currentPmt);
    const onTrack = projectedAssets >= fireNumber;

    const savingsRate =
      Number.isFinite(annual) && annual > 0
        ? (currentPmt / (annual / 12)) * 100
        : null;
    const emergencyFundMonths = baseline > 0 && emergency > 0 ? emergency / baseline : null;
    const spendVolatilityNoteKey =
      summaryData?.savingsRateStdDev != null && summaryData.savingsRateStdDev > 0.05
        ? "fire.spend_volatility_note"
        : null;

    const sensitivity: SensitivityItem[] = [];
    const fireNumSpend90 = (annualizedSpend * 0.9 * retirementMultiplier) / (swrPct / 100);
    sensitivity.push({
      labelKey: "fire.lever_spend_label",
      valueKey: "fire.lever_fire_less",
      valueParam: formatCurrency(fireNumber - fireNumSpend90),
      explainKey: "fire.lever_spend_explain",
    });
    const pmt500 = requiredMonthlySavings(pv, fireNumber, monthlyRate, nMonths) - 500;
    sensitivity.push({
      labelKey: "fire.lever_save_label",
      valueKey: pmt500 > 0 ? "fire.lever_required_less" : "fire.lever_reaches_sooner",
      valueParam: pmt500 > 0 ? formatCurrency(500) : undefined,
      explainKey: "fire.lever_save_explain",
    });
    const swr35Num = annualRetirementSpend / 0.035;
    sensitivity.push({
      labelKey: "fire.lever_swr_label",
      valueKey: "fire.lever_required_more",
      valueParam: formatCurrency(swr35Num - fireNumber),
      explainKey: "fire.lever_swr_explain",
    });

    const newResults: FireResults = {
      fireNumber,
      yearsToTarget,
      requiredMonthlySavings: required,
      onTrack,
      projectedAssetsAtTarget: projectedAssets,
      annualizedSpend,
      annualRetirementSpend,
      savingsRate,
      emergencyFundMonths,
      spendVolatilityNoteKey,
      sensitivity,
    };
    setResults(newResults);
    setHasCalculated(true);
    setHasUnsavedChanges(false);

    try {
      const saved: SavedFireState = {
        inputs: {
          currentAge,
          targetFireAge,
          taxMode,
          investableAssets,
          emergencyFund,
          oneTimeInflow,
          annualIncome,
          monthlySavings,
          incomeGrowthPct,
          baselineMonthlySpend,
          retirementMultiplier,
          inflationPct,
          swrPct,
          investmentReturnPct,
        },
        fromAppData,
        hasCalculated: true,
        results: newResults,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(FIRE_STORAGE_KEY, JSON.stringify(saved));
      }
    } catch {
      // ignore
    }
  }, [
    currentAge,
    targetFireAge,
    investableAssets,
    baselineMonthlySpend,
    annualIncome,
    monthlySavings,
    retirementMultiplier,
    swrPct,
    investmentReturnPct,
    oneTimeInflow,
    emergencyFund,
    summaryData,
    fromAppData,
    taxMode,
    incomeGrowthPct,
    inflationPct,
  ]);

  const handleInputChange = () => setHasUnsavedChanges(true);

  if (dataLoading) {
    return (
      <div className="min-h-screen py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("fire.title")}</h1>
        <p className="mt-4 text-zinc-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("fire.title")}</h1>
      <p className="mt-1 text-zinc-600">{t("fire.subtitle")}</p>
      <p className="mt-1 text-sm text-zinc-500">{t("fire.intro")}</p>

      {hasUnsavedChanges && hasCalculated && (
        <p className="mt-4 text-sm text-amber-700 font-medium">{t("fire.unsaved_hint")}</p>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* A. Inputs Panel */}
        <div className="lg:col-span-1 space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("fire.profile")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.current_age")}</label>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={currentAge === "" ? "" : currentAge}
                  onChange={(e) => { setCurrentAge(e.target.value === "" ? "" : parseInt(e.target.value, 10)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.target_fire_age")}</label>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={targetFireAge === "" ? "" : targetFireAge}
                  onChange={(e) => { setTargetFireAge(e.target.value === "" ? "" : parseInt(e.target.value, 10)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.tax_assumption")}</label>
                <select
                  value={taxMode}
                  onChange={(e) => { setTaxMode(e.target.value as TaxMode); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="ignore">{t("fire.tax_ignore")}</option>
                  <option value="basic">{t("fire.tax_basic")}</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("fire.current_assets")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.investable_assets")}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={investableAssets === "" ? "" : investableAssets}
                  onChange={(e) => { setInvestableAssets(e.target.value === "" ? "" : parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.emergency_fund")}</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={emergencyFund === "" ? "" : emergencyFund}
                  onChange={(e) => { setEmergencyFund(e.target.value === "" ? "" : parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.one_time_flow")}</label>
                <input
                  type="number"
                  step={1000}
                  placeholder={t("fire.one_time_placeholder")}
                  value={oneTimeInflow === "" ? "" : oneTimeInflow}
                  onChange={(e) => { setOneTimeInflow(e.target.value === "" ? "" : parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("fire.income_savings")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.annual_income")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={annualIncome === "" ? "" : annualIncome}
                    onChange={(e) => { setAnnualIncome(e.target.value === "" ? "" : parseFloat(e.target.value)); handleInputChange(); }}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  {fromAppData.income && <span className="text-xs text-blue-600 font-medium whitespace-nowrap">{t("fire.using_app_data")}</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.monthly_savings")}</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder={t("fire.monthly_savings_placeholder")}
                  value={monthlySavings === "" ? "" : monthlySavings}
                  onChange={(e) => { setMonthlySavings(e.target.value === "" ? "" : parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.income_growth")}</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={incomeGrowthPct}
                  onChange={(e) => { setIncomeGrowthPct(parseFloat(e.target.value) || 0); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("fire.spending_assumptions")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.baseline_spend")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={baselineMonthlySpend === "" ? "" : baselineMonthlySpend}
                    onChange={(e) => {
                      setBaselineMonthlySpend(e.target.value === "" ? "" : parseFloat(e.target.value));
                      setFromAppData((p) => ({ ...p, baselineSpend: false }));
                      handleInputChange();
                    }}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  {fromAppData.baselineSpend && <span className="text-xs text-blue-600 font-medium whitespace-nowrap">{t("fire.using_app_data")}</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.retirement_multiplier")}</label>
                <select
                  value={retirementMultiplier}
                  onChange={(e) => { setRetirementMultiplier(parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value={0.8}>0.8×</option>
                  <option value={1}>1.0×</option>
                  <option value={1.2}>1.2×</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.inflation")}</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={inflationPct}
                  onChange={(e) => { setInflationPct(parseFloat(e.target.value) || 0); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.swr")}</label>
                <select
                  value={swrPct}
                  onChange={(e) => { setSwrPct(parseFloat(e.target.value)); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value={3}>3%</option>
                  <option value={3.5}>3.5%</option>
                  <option value={4}>4%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("fire.investment_return")}</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={investmentReturnPct}
                  onChange={(e) => { setInvestmentReturnPct(parseFloat(e.target.value) || 0); handleInputChange(); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">{t("fire.real_return_note")}</p>
              </div>
            </div>
          </section>

          {/* B. Calculate CTA */}
          <button
            type="button"
            onClick={() => {
              setCalculating(true);
              setTimeout(() => {
                runCalculation();
                setCalculating(false);
              }, 400);
            }}
            disabled={calculating}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 px-4 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-60 transition-all"
          >
            {calculating ? t("fire.calculating") : hasCalculated && hasUnsavedChanges ? t("fire.recalculate") : t("fire.calculate")}
          </button>
        </div>

        {/* C. Results Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {!hasCalculated && !results && (
            <div className="rounded-3xl border border-gray-100 bg-white p-12 shadow-sm text-center text-gray-500">
              <p>{t("fire.enter_details")}</p>
            </div>
          )}

          {results && (
            <>
              {/* Result Hero */}
              <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-6">{t("fire.your_plan")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("fire.fire_number")}</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.fireNumber)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("fire.years_to_target")}</p>
                    <p className="text-2xl font-bold text-gray-900">{results.yearsToTarget}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("fire.status")}</p>
                    <p className={`text-xl font-bold ${results.onTrack ? "text-green-600" : "text-amber-600"}`}>
                      {results.onTrack ? t("fire.on_track") : t("fire.off_track")}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">{t("fire.required_savings_label")}</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(results.requiredMonthlySavings)}</p>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  {t("fire.disclaimer").replace("{swr}", String(swrPct)).replace("{ret}", String(investmentReturnPct)).replace("{inf}", String(inflationPct))}
                </p>
              </section>

              {/* Progress bar */}
              <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("fire.progress_to_fire")}</h3>
                <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{
                      width: `${Math.min(100, (results.fireNumber > 0 ? (typeof investableAssets === "number" ? investableAssets : parseFloat(String(investableAssets)) || 0) / results.fireNumber * 100 : 0))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {formatCurrency(typeof investableAssets === "number" ? investableAssets : parseFloat(String(investableAssets)) || 0)} / {formatCurrency(results.fireNumber)}
                </p>
              </section>

              {/* Savings rate & runway */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {results.savingsRate != null && (
                  <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{t("fire.savings_rate_today")}</h3>
                    <p className="text-2xl font-bold text-gray-900">{formatPct(results.savingsRate)}</p>
                  </section>
                )}
                {results.emergencyFundMonths != null && results.emergencyFundMonths > 0 && (
                  <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{t("fire.emergency_runway")}</h3>
                    <p className="text-2xl font-bold text-gray-900">{results.emergencyFundMonths.toFixed(1)} {t("fire.months")}</p>
                    {results.emergencyFundMonths < 6 && (
                      <p className="mt-2 text-xs text-amber-700">{t("fire.emergency_low_hint")}</p>
                    )}
                  </section>
                )}
              </div>

              {(results.spendVolatilityNoteKey || results.spendVolatilityNote) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
                  {results.spendVolatilityNoteKey ? t(results.spendVolatilityNoteKey) : results.spendVolatilityNote}
                </div>
              )}

              {/* Sensitivity */}
              <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t("fire.top_levers")}</h3>
                <p className="text-xs text-gray-500 mb-4">{t("fire.top_levers_hint")}</p>
                <div className="flex flex-wrap gap-3">
                  {results.sensitivity.map((s, i) => {
                    if ("labelKey" in s) {
                      const valueStr = s.valueParam != null ? t(s.valueKey).replace("{amount}", s.valueParam) : t(s.valueKey);
                      return (
                        <div key={i} className="rounded-xl bg-gray-50 px-4 py-3 text-sm max-w-xs">
                          <div className="font-medium text-gray-700">{t(s.labelKey)}</div>
                          <div className="text-gray-600 mt-0.5">→ {valueStr}</div>
                          <p className="text-xs text-gray-500 mt-2 leading-snug">{t(s.explainKey)}</p>
                        </div>
                      );
                    }
                    const explanation =
                      s.label.startsWith("Spend") ? t("fire.lever_spend_explain")
                        : s.label.startsWith("Save") ? t("fire.lever_save_explain")
                          : s.label.startsWith("SWR") ? t("fire.lever_swr_explain") : null;
                    return (
                      <div key={i} className="rounded-xl bg-gray-50 px-4 py-3 text-sm max-w-xs">
                        <div className="font-medium text-gray-700">{s.label}</div>
                        <div className="text-gray-600 mt-0.5">→ {s.value}</div>
                        {explanation != null && <p className="text-xs text-gray-500 mt-2 leading-snug">{explanation}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
