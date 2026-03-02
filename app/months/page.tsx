import Link from "next/link";
import { redirect } from "next/navigation";
import { getStatementMonths } from "@/lib/db";

/**
 * Redirects to the dashboard for the most recent month with data.
 * If no months exist, show a short message and link to Upload.
 */
export default async function MonthsPage() {
  let months: string[] = [];
  if (process.env.DATABASE_URL) {
    try {
      months = await getStatementMonths();
    } catch {
      // ignore
    }
  }

  if (months.length > 0) {
    redirect(`/month/${months[0]}`);
  }

  return (
    <div className="min-h-screen py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-zinc-600">
        No months with imported transactions yet. Upload statements from the{" "}
        <Link href="/upload" className="text-blue-600 hover:underline">
          Upload
        </Link>{" "}
        page to get started.
      </p>
    </div>
  );
}
