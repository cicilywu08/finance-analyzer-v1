import Link from "next/link";
import { getStatementMonths } from "@/lib/db";
import { MonthDetailClient } from "./MonthDetailClient";

/**
 * Month detail page. Category breakdown, run categorization, transaction table, rent/income summary.
 */

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return yearMonth;
  const date = new Date(y, m - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Sort YYYY-MM strings chronologically ascending (oldest first). */
function sortMonthsAsc(months: string[]): string[] {
  return [...months].sort((a, b) => a.localeCompare(b));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MonthDetailPage({ params }: PageProps) {
  const { id } = await params;
  const monthLabel = getMonthLabel(id);

  let availableMonths: string[] = [];
  if (process.env.DATABASE_URL) {
    try {
      availableMonths = await getStatementMonths();
    } catch {
      // ignore; show no month pills
    }
  }
  const switcherMonths = sortMonthsAsc(availableMonths);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard header */}
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
                  Financial Dashboard
                </h1>
                <p className="text-sm text-gray-500">{monthLabel} Overview</p>
              </div>
            </div>
            <Link
              href="#transactions"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Transactions
            </Link>
          </div>
        </div>
        {/* Month switcher pills — only months that have uploaded data; active = gradient + white + shadow */}
        {switcherMonths.length > 0 && (
          <div className="px-6 pb-4 flex items-center justify-center gap-3 flex-wrap">
            {switcherMonths.map((ym) => {
              const isActive = ym === id;
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        <MonthDetailClient yearMonth={id} />
      </main>
    </div>
  );
}
