import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-6 font-sans">
      <nav className="mb-8 flex gap-4">
        <Link href="/upload" className="text-blue-600 hover:underline">
          Upload
        </Link>
        <Link href="/months" className="text-blue-600 hover:underline">
          Months
        </Link>
        <Link href="/settings" className="text-blue-600 hover:underline">
          Settings
        </Link>
      </nav>
      <main className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Finance Analyzer V1
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Upload Chase statement PDFs, view spending by category and financial
          indicators. Scaffolding only; logic not implemented.
        </p>
        <ul className="mt-6 list-inside list-disc space-y-1 text-sm text-zinc-600">
          <li>
            <Link href="/upload" className="text-blue-600 hover:underline">
              /upload
            </Link>{" "}
            – Upload up to 12 PDFs
          </li>
          <li>
            <Link href="/months" className="text-blue-600 hover:underline">
              /months
            </Link>{" "}
            – Months overview
          </li>
          <li>
            <Link href="/month/2026-01" className="text-blue-600 hover:underline">
              /month/[id]
            </Link>{" "}
            – Month detail
          </li>
          <li>
            <Link href="/settings" className="text-blue-600 hover:underline">
              /settings
            </Link>{" "}
            – Rent & income
          </li>
        </ul>
      </main>
    </div>
  );
}
