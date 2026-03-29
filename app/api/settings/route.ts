import {
  getDefaultRentAndIncome,
  setDefaultRentAndIncome,
  getMonthOverrides,
  setMonthOverrides,
  getStatementMonths,
} from "@/lib/db";

/** Normalize unknown request JSON to number | null. Handles null/undefined, number (if finite), string (trim; empty → null; else Number). */
function toNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface SettingsGetResponse {
  defaults: { rent: number | null; income: number | null };
  overrides: Array<{ year: number; month: number; rent: number | null; income: number | null }>;
  /** All statement months (YYYY-MM) for building overrides UI. */
  statementMonths: string[];
}

/** GET: return default rent/income and all per-month overrides. Returns empty data when DB is not configured. */
export async function GET(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json({
      defaults: { rent: null, income: null },
      overrides: [],
      statementMonths: [],
    } satisfies SettingsGetResponse);
  }
  try {
    const [defaults, overrides, statementMonths] = await Promise.all([
      getDefaultRentAndIncome(),
      getMonthOverrides(),
      getStatementMonths(),
    ]);
    return Response.json({
      defaults: { rent: defaults.rent, income: defaults.income },
      overrides: overrides.map((r) => ({
        year: r.statement_year,
        month: r.statement_month,
        rent: r.rent_override,
        income: r.income_override,
      })),
      statementMonths,
    } satisfies SettingsGetResponse);
  } catch (err) {
    console.error("[settings GET]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load settings." },
      { status: 500 }
    );
  }
}

/** POST: save defaults and overrides. Body: { defaults?: { rent?, income? }, overrides?: [{ year, month, rent?, income? }] } */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "DATABASE_URL not set." }, { status: 500 });
  }
  try {
    const body = await request.json().catch(() => ({}));

    const def = body.defaults as { rent?: unknown; income?: unknown } | undefined;
    if (def && (typeof def.rent !== "undefined" || typeof def.income !== "undefined")) {
      const rent = toNullableNumber(def.rent);
      const income = toNullableNumber(def.income);
      await setDefaultRentAndIncome(rent, income);
    }

    const overrides = Array.isArray(body.overrides) ? body.overrides : [];
    if (overrides.length > 0) {
      const normalized = overrides
        .map((o: { year?: unknown; month?: unknown; rent?: unknown; income?: unknown }) => ({
          year: Number(o.year),
          month: Number(o.month),
          rent: toNullableNumber(o.rent),
          income: toNullableNumber(o.income),
        }))
        .filter((o: { year: number; month: number }) => !isNaN(o.year) && !isNaN(o.month) && o.month >= 1 && o.month <= 12);
      await setMonthOverrides(normalized);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[settings POST]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save settings." },
      { status: 500 }
    );
  }
}
