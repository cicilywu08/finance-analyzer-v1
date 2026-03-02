import Link from "next/link";
import { MonthDetailClient } from "./MonthDetailClient";

/**
 * Month detail page. Category breakdown, run categorization, transaction table, rent/income summary.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MonthDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="min-h-screen py-6">
      <Link href="/months" className="text-sm text-blue-600 hover:underline">
        ← Back to months
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{id}</h1>
      <p className="mt-1 text-zinc-600">
        Category breakdown, categorization, and transactions.
      </p>
      <MonthDetailClient yearMonth={id} />
    </div>
  );
}
