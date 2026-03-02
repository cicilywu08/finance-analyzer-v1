"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MAX_FILES = 12;
const API_PATH = "/api/upload";
const FORM_FIELD = "files";

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

function FileResult({
  row,
  index,
}: {
  row: UploadResultItem;
  index: number;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const hasFailures = row.parseFailureCount > 0;
  const hasPreview = row.previewTransactions.length > 0;

  return (
    <div className="border border-zinc-200 rounded p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{row.filename}</span>
        <span className="text-zinc-500">{row.detectedYearMonth ?? "—"}</span>
        <span className={row.status === "ok" ? "text-green-600" : "text-red-600"}>
          {row.status}
        </span>
        {row.error && (
          <span className="text-red-600" role="alert">{row.error}</span>
        )}
        <span className="text-zinc-600">
          Transactions: {row.transactionCount}
        </span>
        <span className="text-zinc-600">
          Parse failures: {row.parseFailureCount}
        </span>
      </div>

      {hasFailures && (
        <p className="text-amber-700 text-sm font-medium" role="alert">
          Some lines could not be parsed as transactions.
        </p>
      )}

      {hasPreview && (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            className="text-sm text-blue-600 hover:underline"
          >
            {previewOpen ? "Hide" : "Show"} first 10 transactions
          </button>
          {previewOpen && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border border-zinc-300 text-left text-sm">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">date</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">merchant_raw</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">amount</th>
                    <th className="border-b border-zinc-300 px-2 py-1.5 font-medium">exchangeRateMetadata</th>
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
            {failuresOpen ? "Hide" : "Show"} first 20 failure lines
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

/** Unique detectedYearMonth from results that have transactionCount > 0. */
function getMonthsWithTransactions(results: UploadResultItem[]): string[] {
  const set = new Set<string>();
  for (const r of results) {
    if (r.detectedYearMonth && r.transactionCount > 0) set.add(r.detectedYearMonth);
  }
  return [...set].sort();
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [results, setResults] = useState<UploadResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileCount = files?.length ?? 0;
  const overLimit = fileCount > MAX_FILES;
  const duplicateMonths = results ? getDuplicateMonths(results) : [];
  const monthsWithTxns = results ? getMonthsWithTransactions(results) : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    setFiles(selected ?? null);
    setResults(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files?.length) return;
    if (fileCount > MAX_FILES) return;

    setLoading(true);
    setSubmitError(null);
    setResults(null);

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
      const months = getMonthsWithTransactions(data);
      if (months.length === 1) {
        router.push(`/month/${months[0]}`);
        return;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Upload statements</h1>
      <p className="mt-2 text-zinc-600">
        Upload 1–12 Chase credit card statement PDFs.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          {fileCount > 0 && (
            <p className="mt-2 text-sm text-zinc-600">
              Selected: {fileCount} file{fileCount !== 1 ? "s" : ""}.
              {overLimit && (
                <span className="ml-2 font-medium text-red-600">
                  Maximum {MAX_FILES} files. Please remove {fileCount - MAX_FILES}.
                </span>
              )}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!fileCount || overLimit || loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
        >
          {loading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {submitError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {submitError}
        </p>
      )}

      {duplicateMonths.length > 0 && (
        <p className="mt-4 text-sm font-medium text-amber-700" role="alert">
          Duplicate month(s) in this batch: {duplicateMonths.join(", ")}. Consider overwriting or skipping.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="mt-6 space-y-4">
          {monthsWithTxns.length > 1 && (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-700 mb-2">Go to month</p>
              <ul className="flex flex-wrap gap-2">
                {monthsWithTxns.map((ym) => (
                  <li key={ym}>
                    <Link
                      href={`/month/${ym}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {ym}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.map((row, i) => (
            <FileResult key={i} row={row} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
