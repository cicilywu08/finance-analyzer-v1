/**
 * Postgres integration. Single global pool, stable for Next.js + DigitalOcean.
 * Set DATABASE_URL in env. Schema is inited once at server startup (instrumentation).
 */

import { Pool } from "pg";
import type { ParsedTransaction } from "./parser";

const globalForDb = globalThis as unknown as { _pool: Pool | null };

function getPool(): Pool {
  if (globalForDb._pool) {
    return globalForDb._pool;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const useSsl = url.includes("sslmode=");
  globalForDb._pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return globalForDb._pool;
}

export async function getDb(): Promise<Pool> {
  return getPool();
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  statement_year INT NOT NULL,
  statement_month INT NOT NULL,
  transaction_date VARCHAR(10) NOT NULL,
  merchant_raw TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10),
  exchange_rate_metadata TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const ALTER_TRANSACTIONS_COLUMNS = [
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT",
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence REAL",
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_source TEXT DEFAULT 'unknown'",
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ",
];

const CREATE_MERCHANT_CACHE = `
CREATE TABLE IF NOT EXISTS merchant_category_cache (
  merchant_raw TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const CREATE_SETTINGS_DEFAULTS = `
CREATE TABLE IF NOT EXISTS settings_defaults (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_rent NUMERIC(12,2),
  default_income NUMERIC(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const CREATE_MONTH_OVERRIDES = `
CREATE TABLE IF NOT EXISTS month_overrides (
  statement_year INT NOT NULL,
  statement_month INT NOT NULL,
  rent_override NUMERIC(12,2),
  income_override NUMERIC(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (statement_year, statement_month)
);
`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function initSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(CREATE_TABLE);
    for (const sql of ALTER_TRANSACTIONS_COLUMNS) {
      await client.query(sql);
    }
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions (statement_year, statement_month)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_transactions_statement_category ON transactions (statement_year, statement_month, category)"
    );
    await client.query(CREATE_MERCHANT_CACHE);
    await client.query(CREATE_SETTINGS_DEFAULTS);
    await client.query(CREATE_MONTH_OVERRIDES);
    await client.query(CREATE_USERS);
    await client.query(
      "INSERT INTO settings_defaults (id, default_rent, default_income) SELECT 1, NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM settings_defaults WHERE id = 1)"
    );
    // Seed: STARRY.COM (home internet) → Bills & Utilities
    await client.query(
      `UPDATE transactions SET category = 'Bills & Utilities', confidence = 1, category_source = 'seed'
       WHERE LOWER(TRIM(merchant_raw)) = 'starry.com starry.com ma'`
    );
    const starryRows = await client.query<{ merchant_raw: string }>(
      `SELECT DISTINCT merchant_raw FROM transactions WHERE LOWER(TRIM(merchant_raw)) = 'starry.com starry.com ma'`
    );
    for (const row of starryRows.rows) {
      await client.query(
        `INSERT INTO merchant_category_cache (merchant_raw, category, confidence, source, updated_at)
         VALUES ($1, 'Bills & Utilities', 1, 'seed', NOW())
         ON CONFLICT (merchant_raw) DO UPDATE SET category = 'Bills & Utilities', confidence = 1, source = 'seed', updated_at = NOW()`,
        [row.merchant_raw]
      );
    }
  } finally {
    client.release();
  }
}

export interface DbTransaction {
  id: number;
  statement_year: number;
  statement_month: number;
  transaction_date: string;
  merchant_raw: string;
  amount: number;
  currency: string | null;
  exchange_rate_metadata: string | null;
  category: string | null;
  confidence: number | null;
  category_source: string | null;
  classified_at: Date | null;
  created_at: Date;
}

/** Insert parsed transactions for a statement month. Replaces any existing rows for (year, month). */
export async function saveTransactions(
  statementYear: number,
  statementMonth: number,
  transactions: ParsedTransaction[]
): Promise<void> {
  if (transactions.length === 0) return;
  const client = await getPool().connect();
  try {
    await client.query(
      "DELETE FROM transactions WHERE statement_year = $1 AND statement_month = $2",
      [statementYear, statementMonth]
    );
    const batchSize = 100;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const values: (string | number | null)[] = [];
      const placeholders: string[] = [];
      batch.forEach((t, j) => {
        const base = 1 + j * 7;
        placeholders.push(
          `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        );
        values.push(
          statementYear,
          statementMonth,
          t.date,
          t.merchant_raw,
          t.amount,
          t.currency ?? null,
          t.exchangeRateMetadata ?? null
        );
      });
      await client.query(
        `INSERT INTO transactions (statement_year, statement_month, transaction_date, merchant_raw, amount, currency, exchange_rate_metadata)
         VALUES ${placeholders.join(", ")}`,
        values
      );
    }
  } finally {
    client.release();
  }
}

/** List distinct statement months (YYYY-MM) that have transactions, newest first. */
export async function getStatementMonths(): Promise<string[]> {
  const res = await getPool().query<{ year: number; month: number }>(
    `SELECT DISTINCT statement_year AS year, statement_month AS month
     FROM transactions ORDER BY statement_year DESC, statement_month DESC`
  );
  return res.rows.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`);
}

/** Load all transactions for a statement month. */
export async function getTransactionsByMonth(
  statementYear: number,
  statementMonth: number
): Promise<DbTransaction[]> {
  const res = await getPool().query<DbTransaction>(
    `SELECT id, statement_year, statement_month, transaction_date, merchant_raw, amount, currency, exchange_rate_metadata,
      category, confidence, category_source, classified_at, created_at
     FROM transactions WHERE statement_year = $1 AND statement_month = $2 ORDER BY transaction_date, id`,
    [statementYear, statementMonth]
  );
  return res.rows;
}

/** Load transactions that need classification (category IS NULL OR category_source = 'unknown'). */
export async function getUnclassifiedTransactions(
  statementYear: number,
  statementMonth: number
): Promise<DbTransaction[]> {
  const res = await getPool().query<DbTransaction>(
    `SELECT id, statement_year, statement_month, transaction_date, merchant_raw, amount, currency, exchange_rate_metadata,
      category, confidence, category_source, classified_at, created_at
     FROM transactions
     WHERE statement_year = $1 AND statement_month = $2
       AND (category IS NULL OR category_source = 'unknown')
     ORDER BY id`,
    [statementYear, statementMonth]
  );
  return res.rows;
}

export async function updateTransactionCategory(
  id: number,
  category: string,
  confidence: number,
  categorySource: string
): Promise<void> {
  await getPool().query(
    `UPDATE transactions SET category = $1, confidence = $2, category_source = $3, classified_at = NOW() WHERE id = $4`,
    [category, confidence, categorySource, id]
  );
}

/** Force Card Payment for descriptions that are card payments (e.g. AUTOMATIC PAYMENT). Fixes previously misclassified rows. Returns count and distinct merchant_raw updated. */
export async function correctCardPaymentDescriptions(
  statementYear: number,
  statementMonth: number
): Promise<{ count: number; merchantRaws: string[] }> {
  const res = await getPool().query<{ merchant_raw: string }>(
    `UPDATE transactions
     SET category = 'Card Payment', confidence = 1, category_source = 'override', classified_at = NOW()
     WHERE statement_year = $1 AND statement_month = $2
       AND (category IS NULL OR category != 'Card Payment')
       AND (
         merchant_raw ILIKE '%AUTOMATIC PAYMENT%'
         OR merchant_raw ILIKE '%PAYMENT - THANK YOU%'
         OR merchant_raw ILIKE '%PAYMENT THANK YOU%'
         OR TRIM(merchant_raw) ILIKE 'THANK YOU'
       )
     RETURNING merchant_raw`,
    [statementYear, statementMonth]
  );
  const merchantRaws = [...new Set(res.rows.map((r) => r.merchant_raw))];
  return { count: res.rowCount ?? 0, merchantRaws };
}

export interface CategoryBreakdownRow {
  category: string;
  total_amount: string;
  percent: number;
}

/** Spend share: percent = category net / total net. Excludes Card Payment. totalSpend = sum of totalAmount (net, refunds already in). totalCredits = sum of negative amounts (excludes Card Payment). */
export async function getCategoryBreakdown(
  statementYear: number,
  statementMonth: number
): Promise<{
  rows: CategoryBreakdownRow[];
  totalCredits: number;
  lowConfidenceCount: number;
  netSpendTotal: number;
  /** Total spend (sum of category debits, excludes Card Payment) = sum of totalAmount column. */
  totalSpend: number;
}> {
  const [sumRes, lowRes, netRes, creditsRes, spendRes] = await Promise.all([
    getPool().query<{ category: string; total_amount: string; debit_sum: string }>(
      `SELECT COALESCE(category, 'Uncategorized') AS category,
         SUM(amount)::TEXT AS total_amount,
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::TEXT AS debit_sum
       FROM transactions WHERE statement_year = $1 AND statement_month = $2 GROUP BY category`,
      [statementYear, statementMonth]
    ),
    getPool().query<{ n: string }>(
      `SELECT COUNT(*)::TEXT AS n FROM transactions
       WHERE statement_year = $1 AND statement_month = $2 AND confidence IS NOT NULL AND confidence < 0.6`,
      [statementYear, statementMonth]
    ),
    getPool().query<{ net: string }>(
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS net FROM transactions
       WHERE statement_year = $1 AND statement_month = $2`,
      [statementYear, statementMonth]
    ),
    getPool().query<{ credits: string }>(
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS credits FROM transactions
       WHERE statement_year = $1 AND statement_month = $2 AND amount < 0
         AND (category IS NULL OR category != 'Card Payment')`,
      [statementYear, statementMonth]
    ),
    getPool().query<{ spend: string }>(
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS spend FROM transactions
       WHERE statement_year = $1 AND statement_month = $2 AND (category IS NULL OR category != 'Card Payment')`,
      [statementYear, statementMonth]
    ),
  ]);
  const excludeCategory = "Card Payment";
  const expenseRows = sumRes.rows.filter((r) => r.category !== excludeCategory);
  const totalSpend = spendRes.rows[0] ? parseFloat(spendRes.rows[0].spend) : 0;
  const rows: CategoryBreakdownRow[] = expenseRows
    .map((r) => {
    const netAmount = parseFloat(r.total_amount);
    const percent = totalSpend > 0 ? (netAmount / totalSpend) * 100 : 0;
    return {
      category: r.category,
      total_amount: r.total_amount,
      percent,
    };
  })
    .sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));
  const lowConfidenceCount = lowRes.rows[0] ? parseInt(lowRes.rows[0].n, 10) : 0;
  const netSpendTotal = netRes.rows[0] ? parseFloat(netRes.rows[0].net) : 0;
  const totalCredits = creditsRes.rows[0] ? parseFloat(creditsRes.rows[0].credits) : 0;
  return { rows, totalCredits, lowConfidenceCount, netSpendTotal, totalSpend };
}

/** Get cached category for merchant if confidence >= minConfidence. */
export async function getMerchantCached(
  merchantRaw: string,
  minConfidence: number = 0.8
): Promise<{ category: string; confidence: number } | null> {
  const r = await getPool().query<{ category: string; confidence: number }>(
    "SELECT category, confidence FROM merchant_category_cache WHERE merchant_raw = $1 AND confidence >= $2",
    [merchantRaw, minConfidence]
  );
  return r.rows[0] ?? null;
}

/** Upsert merchant category cache. */
export async function upsertMerchantCache(
  merchantRaw: string,
  category: string,
  confidence: number,
  source: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO merchant_category_cache (merchant_raw, category, confidence, source, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (merchant_raw) DO UPDATE SET category = $2, confidence = $3, source = $4, updated_at = NOW()`,
    [merchantRaw, category, confidence, source]
  );
}

// --- Settings: default rent/income and per-month overrides ---

export async function getDefaultRentAndIncome(): Promise<{
  rent: number | null;
  income: number | null;
}> {
  const r = await getPool().query<{ default_rent: string | null; default_income: string | null }>(
    "SELECT default_rent, default_income FROM settings_defaults WHERE id = 1"
  );
  const row = r.rows[0];
  if (!row) return { rent: null, income: null };
  return {
    rent: row.default_rent != null ? parseFloat(row.default_rent) : null,
    income: row.default_income != null ? parseFloat(row.default_income) : null,
  };
}

export async function setDefaultRentAndIncome(
  rent: number | null,
  income: number | null
): Promise<void> {
  await getPool().query(
    `INSERT INTO settings_defaults (id, default_rent, default_income, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET default_rent = $1, default_income = $2, updated_at = NOW()`,
    [rent, income]
  );
}

export interface MonthOverrideRow {
  statement_year: number;
  statement_month: number;
  rent_override: number | null;
  income_override: number | null;
}

export async function getMonthOverrides(): Promise<MonthOverrideRow[]> {
  const res = await getPool().query<{
    statement_year: number;
    statement_month: number;
    rent_override: string | null;
    income_override: string | null;
  }>(
    `SELECT statement_year, statement_month, rent_override, income_override
     FROM month_overrides ORDER BY statement_year DESC, statement_month DESC`
  );
  return res.rows.map((r) => ({
    statement_year: r.statement_year,
    statement_month: r.statement_month,
    rent_override: r.rent_override != null ? parseFloat(r.rent_override) : null,
    income_override: r.income_override != null ? parseFloat(r.income_override) : null,
  }));
}

/** Rent and income for a month: override if set, else defaults. */
export async function getRentIncomeForMonth(
  statementYear: number,
  statementMonth: number
): Promise<{ rent: number | null; income: number | null }> {
  const [defaults, override] = await Promise.all([
    getDefaultRentAndIncome(),
    getPool().query<{ rent_override: string | null; income_override: string | null }>(
      `SELECT rent_override, income_override FROM month_overrides
       WHERE statement_year = $1 AND statement_month = $2`,
      [statementYear, statementMonth]
    ),
  ]);
  const row = override.rows[0];
  return {
    rent: row?.rent_override != null ? parseFloat(row.rent_override) : defaults.rent,
    income: row?.income_override != null ? parseFloat(row.income_override) : defaults.income,
  };
}

export async function setMonthOverride(
  statementYear: number,
  statementMonth: number,
  rent: number | null,
  income: number | null
): Promise<void> {
  await getPool().query(
    `INSERT INTO month_overrides (statement_year, statement_month, rent_override, income_override, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (statement_year, statement_month)
     DO UPDATE SET rent_override = $3, income_override = $4, updated_at = NOW()`,
    [statementYear, statementMonth, rent, income]
  );
}

/** Save multiple month overrides; null means "use default" (delete override row). */
export async function setMonthOverrides(
  overrides: Array<{ year: number; month: number; rent: number | null; income: number | null }>
): Promise<void> {
  const client = await getPool().connect();
  try {
    for (const { year, month, rent, income } of overrides) {
      if (rent == null && income == null) {
        await client.query(
          "DELETE FROM month_overrides WHERE statement_year = $1 AND statement_month = $2",
          [year, month]
        );
      } else {
        await client.query(
          `INSERT INTO month_overrides (statement_year, statement_month, rent_override, income_override, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (statement_year, statement_month)
           DO UPDATE SET rent_override = $3, income_override = $4, updated_at = NOW()`,
          [year, month, rent, income]
        );
      }
    }
  } finally {
    client.release();
  }
}

// --- Insights (Feature 5): category totals by month, recurring merchants, top merchants ---

/** Category total (net spend) for one month. Excludes Card Payment. */
export async function getCategoryTotalsForMonth(
  statementYear: number,
  statementMonth: number
): Promise<Record<string, number>> {
  const res = await getPool().query<{ category: string; total: string }>(
    `SELECT COALESCE(category, 'Uncategorized') AS category, SUM(amount)::TEXT AS total
     FROM transactions
     WHERE statement_year = $1 AND statement_month = $2 AND (category IS NULL OR category != 'Card Payment')
     GROUP BY category`,
    [statementYear, statementMonth]
  );
  const out: Record<string, number> = {};
  for (const r of res.rows) {
    out[r.category] = parseFloat(r.total);
  }
  return out;
}

/** Total spend (net) for a month, excluding Card Payment. */
export async function getTotalSpendForMonth(
  statementYear: number,
  statementMonth: number
): Promise<number> {
  const r = await getPool().query<{ spend: string }>(
    `SELECT COALESCE(SUM(amount), 0)::TEXT AS spend FROM transactions
     WHERE statement_year = $1 AND statement_month = $2 AND (category IS NULL OR category != 'Card Payment')`,
    [statementYear, statementMonth]
  );
  return r.rows[0] ? parseFloat(r.rows[0].spend) : 0;
}

/** Merchants that appear in this month and in the previous month (consecutive). Recurring = ≥2 consecutive months. */
export async function getRecurringMerchants(
  statementYear: number,
  statementMonth: number
): Promise<Array<{ merchant_raw: string; months: number }>> {
  const prevMonth = statementMonth === 1 ? { y: statementYear - 1, m: 12 } : { y: statementYear, m: statementMonth - 1 };
  const res = await getPool().query<{ merchant_raw: string; cnt: string }>(
    `SELECT merchant_raw, COUNT(DISTINCT (statement_year, statement_month))::TEXT AS cnt
     FROM transactions
     WHERE (statement_year = $1 AND statement_month = $2)
        OR (statement_year = $3 AND statement_month = $4)
     GROUP BY merchant_raw
     HAVING COUNT(DISTINCT (statement_year, statement_month)) >= 2`,
    [statementYear, statementMonth, prevMonth.y, prevMonth.m]
  );
  return res.rows.map((r) => ({ merchant_raw: r.merchant_raw, months: parseInt(r.cnt, 10) }));
}

/** Top N merchants by total spend (sum of positive amounts) for the month. Excludes Card Payment. Returns primary category (most spend) per merchant. */
export async function getTopMerchantsBySpend(
  statementYear: number,
  statementMonth: number,
  limit: number = 5
): Promise<Array<{ merchant_raw: string; total_spend: number; category: string }>> {
  const res = await getPool().query<{ merchant_raw: string; total: string; category: string | null }>(
    `WITH top_merchants AS (
       SELECT merchant_raw, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::TEXT AS total
       FROM transactions
       WHERE statement_year = $1 AND statement_month = $2 AND (category IS NULL OR category != 'Card Payment')
       GROUP BY merchant_raw
       ORDER BY SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) DESC
       LIMIT $3
     ),
     cat_sums AS (
       SELECT t.merchant_raw, t.category, SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS cat_total
       FROM transactions t
       INNER JOIN top_merchants tm ON tm.merchant_raw = t.merchant_raw
       WHERE t.statement_year = $1 AND t.statement_month = $2 AND (t.category IS NOT NULL AND t.category != 'Card Payment')
       GROUP BY t.merchant_raw, t.category
     ),
     primary_cat AS (
       SELECT DISTINCT ON (merchant_raw) merchant_raw, category
       FROM cat_sums
       ORDER BY merchant_raw, cat_total DESC
     )
     SELECT tm.merchant_raw, tm.total, COALESCE(pc.category, 'Uncategorized') AS category
     FROM top_merchants tm
     LEFT JOIN primary_cat pc ON pc.merchant_raw = tm.merchant_raw
     ORDER BY tm.total::NUMERIC DESC`,
    [statementYear, statementMonth, limit]
  );
  return res.rows.map((r) => ({
    merchant_raw: r.merchant_raw,
    total_spend: parseFloat(r.total),
    category: r.category ?? "Uncategorized",
  }));
}

// --- Auth: users table ---

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const res = await getPool().query<UserRow>(
    "SELECT id, email, password_hash, name FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))",
    [email]
  );
  return res.rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string | null
): Promise<UserRow> {
  const res = await getPool().query<UserRow>(
    "INSERT INTO users (email, password_hash, name) VALUES (LOWER(TRIM($1)), $2, $3) RETURNING id, email, password_hash, name",
    [email, passwordHash, name ?? null]
  );
  return res.rows[0];
}
