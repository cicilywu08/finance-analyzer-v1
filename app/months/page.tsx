"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function MonthsPage() {
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/months")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setMonths(data.months ?? []);
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
  }, []);

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Months</h1>
      <p className="mt-1 text-zinc-600">
        Months with imported transactions. Open a month to see breakdown and set rent/income in{" "}
        <Link href="/settings" className="text-blue-600 hover:underline">Settings</Link>.
      </p>
      {loading && <p className="mt-4 text-sm text-zinc-500">Loading…</p>}
      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && (
        <ul className="mt-4 list-none space-y-1">
          {months.length === 0 ? (
            <li className="text-sm text-zinc-500">No months yet. Upload statements from the Upload page.</li>
          ) : (
            months.map((ym) => (
              <li key={ym}>
                <Link
                  href={`/month/${ym}`}
                  className="block rounded px-2 py-1.5 text-blue-600 hover:bg-zinc-100 hover:underline dark:hover:bg-zinc-800"
                >
                  {ym}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
