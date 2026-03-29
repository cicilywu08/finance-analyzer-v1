/**
 * Runs once when the Next.js server starts. Inits DB schema when DATABASE_URL
 * and ENABLE_DB_WRITE are set. In development, failures are logged so the dev
 * server still starts if Postgres is down; in production, init failure fails
 * fast so misconfigured deploys surface immediately.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_DB_WRITE !== "true") return;
  if (!process.env.DATABASE_URL) return;

  const { initSchema } = await import("@/lib/db");
  try {
    await initSchema();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[DB] initSchema failed (dev); fix DATABASE_URL or start Postgres:", e);
    } else {
      throw e;
    }
  }
}
