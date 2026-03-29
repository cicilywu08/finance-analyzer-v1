import { getStatementMonths } from "@/lib/db";
import { MonthDetailClient } from "./MonthDetailClient";
import { MonthPageHeader } from "./MonthPageHeader";

/** Sort YYYY-MM strings chronologically ascending (oldest first). */
function sortMonthsAsc(months: string[]): string[] {
  return [...months].sort((a, b) => a.localeCompare(b));
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return yearMonth;
  const date = new Date(y, m - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
      <MonthPageHeader yearMonth={id} monthLabel={monthLabel} switcherMonths={switcherMonths} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <MonthDetailClient yearMonth={id} />
      </main>
    </div>
  );
}
