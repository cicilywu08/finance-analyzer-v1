import { redirect } from "next/navigation";
import { getStatementMonths } from "@/lib/db";

/**
 * Default landing: no data → Upload; has data → Dashboard (latest month).
 */
export default async function Home() {
  let months: string[] = [];
  if (process.env.DATABASE_URL) {
    try {
      months = await getStatementMonths();
    } catch {
      // ignore
    }
  }

  if (months.length === 0) {
    redirect("/upload");
  }

  redirect(`/month/${months[0]}`);
}
