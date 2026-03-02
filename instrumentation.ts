/**
 * Runs once when the Next.js server starts. Ensures a single pool exists and
 * schema is inited so API routes do not call initSchema() on every request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;

  const { getPool, initSchema } = await import("@/lib/db");
  getPool(); // create global pool
  await initSchema();
}
