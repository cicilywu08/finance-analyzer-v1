"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "@/components/LanguageContext";

const MAX_FILES = 12;
const API_PATH = "/api/upload";
const FORM_FIELD = "files";
const POLL_MAX_ATTEMPTS = 10;
const POLL_DELAY_MIN = 500;
const POLL_DELAY_MAX = 800;

type PreviewTransaction = {
  date: string;
  merchant_raw: string;
  amount: number;
  exchangeRateMetadata?: string;
};

type UploadResultItem = {
  filename: string;
  status: "ok" | "error";
  detectedYearMonth: string | null;
  transactionCount: number;
  parseFailureCount: number;
  previewTransactions: PreviewTransaction[];
  failuresPreview: string[];
  error?: string;
};

function getDuplicateMonths(results: UploadResultItem[]): string[] {
  const byMonth = new Map<string, number>();
  for (const r of results) {
    if (r.detectedYearMonth) {
      byMonth.set(
        r.detectedYearMonth,
        (byMonth.get(r.detectedYearMonth) ?? 0) + 1
      );
    }
  }
  return [...byMonth.entries()]
    .filter(([, count]) => count > 1)
    .map(([month]) => month);
}

/** Unique detectedYearMonth from results that have transactionCount > 0. */
function getMonthsWithTransactions(results: UploadResultItem[]): string[] {
  const set = new Set<string>();
  for (const r of results) {
    if (r.detectedYearMonth && r.transactionCount > 0) set.add(r.detectedYearMonth);
  }
  return [...set].sort();
}

function FileResult({
  row,
  index,
}: {
  row: UploadResultItem;
  index: number;
}) {
  const { t } = useTranslations();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const hasFailures = row.parseFailureCount > 0;
  const hasPreview = row.previewTransactions.length > 0;

  return (
    <div className="border border-zinc-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{row.filename}</span>
        <span className="text-zinc-500">{row.detectedYearMonth ?? "—"}</span>
        <span className={row.status === "ok" ? "text-green-600" : "text-red-600"}>
          {row.status === "ok" ? "ok" : t("common.error")}
        </span>
        {row.error && (
          <span className="text-red-600" role="alert">{row.error}</span>
        )}
        <span className="text-zinc-600">
          {t("upload.transactions_label")}: {row.transactionCount}
        </span>
        <span className="text-zinc-600">
          {t("upload.parse_failures")}: {row.parseFailureCount}
        </span>
      </div>

      {hasFailures && (
        <p className="text-amber-700 text-sm font-medium" role="alert">
          {t("upload.some_parse_failures")}
        </p>
      )}

      {hasPreview && (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            className="text-sm text-blue-600 hover:underline"
          >
            {previewOpen ? t("upload.hide_first_10") : t("upload.show_first_10")}
          </button>
          {previewOpen && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border border-zinc-300 text-left text-sm">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">{t("upload.table_date")}</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">{t("upload.table_merchant")}</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">{t("upload.table_amount")}</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">{t("upload.table_metadata")}</th>
                  </tr>
                </thead>
                <tbody>
                  {row.previewTransactions.map((t, i) => (
                    <tr key={i} className="border-b border-zinc-200">
                      <td className="px-2 py-1.5">{t.date}</td>
                      <td className="px-2 py-1.5">{t.merchant_raw}</td>
                      <td className="px-2 py-1.5">{t.amount}</td>
                      <td className="px-2 py-1.5 text-zinc-600">
                        {t.exchangeRateMetadata ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasFailures && row.failuresPreview.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setFailuresOpen((o) => !o)}
            className="text-sm text-amber-700 hover:underline"
          >
            {failuresOpen ? t("upload.hide_first_20") : t("upload.show_first_20_failures")}
          </button>
          {failuresOpen && (
            <ul className="mt-2 list-disc list-inside text-sm text-zinc-600 space-y-0.5 max-h-48 overflow-y-auto">
              {row.failuresPreview.map((line, i) => (
                <li key={i} className="truncate max-w-full" title={line}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [files, setFiles] = useState<FileList | null>(null);
  const [results, setResults] = useState<UploadResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [dragActive, setDragActive] = useState(false);
  const [indexingPhase, setIndexingPhase] = useState<"idle" | "polling" | "timeout">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const fileCount = files?.length ?? 0;
  const overLimit = fileCount > MAX_FILES;
  const duplicateMonths = results ? getDuplicateMonths(results) : [];
  const successfulResults = results ? results.filter((r, i) => r.status === "ok" && !removedIndices.has(i)) : [];
  const monthsWithTxns = results ? getMonthsWithTransactions(results.filter((_, i) => !removedIndices.has(i))) : [];
  const expectedMonthsFromUpload = results ? getMonthsWithTransactions(results) : [];
  const showUploadedCard = successfulResults.length > 0;

  // After upload, poll /api/months until new months are visible, then redirect (or show timeout).
  useEffect(() => {
    if (!results || indexingPhase !== "polling" || expectedMonthsFromUpload.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/months", { cache: "no-store" });
          const json = await res.json();
          const months: string[] = Array.isArray(json?.months) ? json.months : [];
          const allVisible = expectedMonthsFromUpload.every((ym) => months.includes(ym));
          if (allVisible && months.length > 0) {
            if (!cancelled) {
              setIndexingPhase("idle");
              router.push(months.length === 1 ? `/month/${months[0]}` : "/months");
            }
            return;
          }
        } catch {
          // ignore fetch error, retry
        }
        const delay = POLL_DELAY_MIN + Math.random() * (POLL_DELAY_MAX - POLL_DELAY_MIN);
        await new Promise((r) => setTimeout(r, delay));
      }
      if (!cancelled) setIndexingPhase("timeout");
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [results, indexingPhase, expectedMonthsFromUpload, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    setFiles(selected ?? null);
    setResults(null);
    setSubmitError(null);
    setRemovedIndices(new Set());
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files;
    if (!dropped?.length) return;
    setFiles(dropped);
    setResults(null);
    setSubmitError(null);
    setRemovedIndices(new Set());
    if (inputRef.current) {
      const dt = new DataTransfer();
      for (let i = 0; i < dropped.length; i++) dt.items.add(dropped[i]);
      inputRef.current.files = dt.files;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files?.length) return;
    if (fileCount > MAX_FILES) return;

    setLoading(true);
    setSubmitError(null);
    setResults(null);
    setRemovedIndices(new Set());

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append(FORM_FIELD, files[i]);
      }
      const res = await fetch(API_PATH, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Upload failed (${res.status})`);
      }

      const data: UploadResultItem[] = await res.json();
      setResults(data);
      setLoading(false);
      const months = getMonthsWithTransactions(data);
      if (months.length > 0) {
        setIndexingPhase("polling");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const removeUploadedFile = (index: number) => {
    setRemovedIndices((prev) => new Set(prev).add(index));
  };

  const goToDashboard = () => {
    if (monthsWithTxns.length === 1) {
      router.push(`/month/${monthsWithTxns[0]}`);
    } else {
      router.push("/months");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header — matches Figma upload-screen */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {t("upload.title")}
          </h1>
          <p className="text-gray-600">{t("upload.subtitle")}</p>
        </div>

        {/* Upload zone — matches Figma */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative rounded-3xl p-12 border-2 border-dashed transition-all duration-300
              backdrop-blur-lg bg-white/60
              ${dragActive ? "border-blue-500 bg-blue-50/60 scale-[1.02]" : "border-gray-300 hover:border-gray-400"}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              id="file-upload"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
              aria-label="Select statement PDFs"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("upload.drop")}
              </h3>
              <p className="text-gray-600 mb-4">{t("upload.or_click")}</p>
              <p className="text-sm text-gray-500">{t("upload.limit")}</p>
              <p className="mt-3 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                {t("upload.supported_banks")}
              </p>
            </label>
          </div>

          {fileCount > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <p className="text-sm text-gray-600">
                {fileCount} {t("upload.files_selected")}
                {overLimit && (
                  <span className="ml-2 font-medium text-red-600">
                    · {t("upload.max_files").replace("{n}", String(MAX_FILES))}
                  </span>
                )}
              </p>
              <button
                type="submit"
                disabled={overLimit || loading}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "…" : `${t("upload.upload_files")} ${fileCount} file${fileCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3" role="alert">
              <p className="text-sm text-red-700 font-medium">{submitError}</p>
            </div>
          )}

          {duplicateMonths.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3" role="alert">
              <p className="text-sm font-medium text-amber-800">
                {t("upload.duplicate_months").replace("{months}", duplicateMonths.join(", "))}
              </p>
            </div>
          )}
        </form>

        {/* Indexing in progress */}
        {indexingPhase === "polling" && (
          <div className="mt-6 rounded-2xl backdrop-blur-lg bg-white/70 p-6 shadow-lg border border-blue-200">
            <p className="text-center text-gray-700 font-medium">{t("upload.indexing")}</p>
            <p className="text-center text-sm text-gray-500 mt-1">{t("upload.waiting_dashboard")}</p>
          </div>
        )}

        {/* Indexing timeout: go to dashboard anyway */}
        {indexingPhase === "timeout" && (
          <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-6 shadow-lg" role="alert">
            <p className="text-amber-800 font-medium">{t("upload.success_indexing")}</p>
            <p className="text-sm text-amber-700 mt-1">{t("upload.refresh_dashboard")}</p>
            <button
              type="button"
              onClick={() => {
                setIndexingPhase("idle");
                if (monthsWithTxns.length === 1) router.push(`/month/${monthsWithTxns[0]}`);
                else router.push("/months");
              }}
              className="mt-4 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white py-2.5 text-sm font-semibold transition-all"
            >
              {t("upload.go_dashboard_anyway")}
            </button>
          </div>
        )}

        {/* Uploaded Files card — only when at least one successful upload (matches Figma file list) */}
        {showUploadedCard && (
          <div className="mt-6 rounded-2xl backdrop-blur-lg bg-white/70 p-6 shadow-lg">
            <h3 className="font-semibold mb-4">{t("upload.uploaded_files")} ({successfulResults.length})</h3>
            <div className="space-y-3">
              {results!.map((row, i) => {
                if (row.status !== "ok" || removedIndices.has(i)) return null;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/80 shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                            {row.detectedYearMonth ?? "—"}
                          </span>
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUploadedFile(i)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                      aria-label={`Remove ${row.filename}`}
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={goToDashboard}
              disabled={indexingPhase === "polling"}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl h-12 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {indexingPhase === "polling"
                ? "…"
                : `${t("upload.continue_dashboard")} (${successfulResults.length} ${successfulResults.length === 1 ? t("upload.file") : t("upload.files_count")})`}
            </button>
          </div>
        )}

        {/* Error details and month links when we have successful uploads */}
        {results && results.length > 0 && (
          <div className="mt-8 space-y-4">
            {results.some((r) => r.status === "error") && (
              <>
                <p className="text-sm text-red-600 font-medium" role="alert">
                  {t("upload.some_files_failed")}
                </p>
                {results.filter((r) => r.status === "error").map((row, i) => (
                  <FileResult key={`${row.filename}-${i}`} row={row} index={i} />
                ))}
              </>
            )}
            {monthsWithTxns.length > 1 && showUploadedCard && (
              <div className="rounded-xl border border-gray-200 bg-white/80 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">{t("upload.go_to_month")}</p>
                <ul className="flex flex-wrap gap-2">
                  {monthsWithTxns.map((ym) => (
                    <li key={ym}>
                      <Link
                        href={`/month/${ym}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {ym}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
