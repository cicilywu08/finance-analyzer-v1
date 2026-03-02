import {
  initSchema,
  getDefaultRentAndIncome,
  setDefaultRentAndIncome,
  getMonthOverrides,
  setMonthOverrides,
  getStatementMonths,
} from "@/lib/db";

export interface SettingsGetResponse {
  defaults: { rent: number | null; income: number | null };
  overrides: Array<{ year: number; month: number; rent: number | null; income: number | null }>;
  /** All statement months (YYYY-MM) for building overrides UI. */
  statementMonths: string[];
}

/** GET: return default rent/income and all per-month overrides. */
export async function GET(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "DATABASE_URL not set." }, { status: 500 });
  }
  try {
    await initSchema();
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
    await initSchema();

    const def = body.defaults;
    if (def && (typeof def.rent !== "undefined" || typeof def.income !== "undefined")) {
      const rent = def.rent === "" || def.rent == null ? null : (typeof def.rent === "number" ? def.rent : parseFloat(String(def.rent)));
      const income = def.income === "" || def.income == null ? null : (typeof def.income === "number" ? def.income : parseFloat(String(def.income)));
      await setDefaultRentAndIncome(Number.isNaN(rent) ? null : rent, Number.isNaN(income) ? null : income);
    }

    const overrides = Array.isArray(body.overrides) ? body.overrides : [];
    if (overrides.length > 0) {
      const normalized = overrides.map((o: { year?: number; month?: number; rent?: number | null; income?: number | null }) => ({
        year: Number(o.year),
        month: Number(o.month),
        rent: o.rent === "" || o.rent == null ? null : (typeof o.rent === "number" ? o.rent : parseFloat(String(o.rent))),
        income: o.income === "" || o.income == null ? null : (typeof o.income === "number" ? o.income : parseFloat(String(o.income))),
      })).filter((o: { year: number; month: number }) => !isNaN(o.year) && !isNaN(o.month) && o.month >= 1 && o.month <= 12);
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
