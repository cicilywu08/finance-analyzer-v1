/**
 * Chase statement transaction parser. Uses statementYearMonth (YYYY-MM) for year inference
 * when transaction lines only have MM/DD (handles year boundary: Dec txns on Jan statement).
 *
 * Unit-like test cases (behavior):
 * - "02/09 PESO URUGUAYO" → treated as FX metadata: append to previous transaction's exchangeRateMetadata, do NOT add to failures.
 * - Footer "...Page 3 of 4..." → ignored: do NOT add to failures (not transaction-like).
 */

import type { ParsedTransaction } from "../types";
import { parseAmount } from "../utils";

const MAX_TRANSACTIONS_PER_STATEMENT = 500;

/** Real MM/DD or MM/DD/YY at start of line (month 01-12, day 01-31). Used to avoid false transaction-like detection. */
const REAL_DATE_START = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2}))?\s+/;

/** Currency-only line (no amount): e.g. "02/09 PESO URUGUAYO" before "1,949.71 X 0.025962835 (EXCHG RATE)". */
const CURRENCY_ONLY_MERCHANT = /PESO|ARGENTINE PESO|URUGUAYO|EURO|BRITISH POUND|MEXICAN PESO/i;

/** Footer / pagination: do not treat as transaction failure. */
const PAGE_OF_PATTERN = /Page\s+\d+\s+of\s+\d+/i;

function isExchangeRateLine(line: string): boolean {
  const t = line.toUpperCase();
  return (
    t.includes("EXCHG RATE") ||
    t.includes("EXCHANGE RATE") ||
    (t.includes("PESO") && t.includes("EXCHG")) ||
    /\bEXCH(?:ANGE)?\s*RATE\b/i.test(line)
  );
}

/** True if line starts with date but has no amount at end and rest matches currency-only (FX metadata). */
function isCurrencyOnlyFxLine(line: string): boolean {
  const t = line.trim();
  const dateMatch = REAL_DATE_START.exec(t);
  if (!dateMatch) return false;
  const rest = t.slice(dateMatch[0].length).trim();
  if (!rest) return false;
  const hasAmountAtEnd = /(-?\(?[\d,]+\.?\d*\)?|\$[\d,]+\.?\d*)\s*$/.test(rest);
  if (hasAmountAtEnd) return false;
  return CURRENCY_ONLY_MERCHANT.test(rest);
}

/** Only count as transaction-like if it starts with real MM/DD; skip Page X of Y and similar. */
function isTransactionLikeForFailure(line: string): boolean {
  if (!REAL_DATE_START.test(line.trim())) return false;
  if (PAGE_OF_PATTERN.test(line)) return false;
  if (/^(transaction|post|date|description|amount|balance)\b/i.test(line.trim())) return false;
  return true;
}

/** Infer transaction year from statement month: txnMonth <= stmtMonth → stmtYear, else stmtYear - 1. */
function inferTransactionYear(
  txnMonth: number,
  stmtYear: number,
  stmtMonth: number
): number {
  return txnMonth <= stmtMonth ? stmtYear : stmtYear - 1;
}

/** Parse one line as transaction. Returns YYYY-MM-DD for date. Uses real MM/DD only (01-12, 01-31). */
function parseTransactionLine(
  line: string,
  stmtYear: number,
  stmtMonth: number
): ParsedTransaction | null {
  const t = line.trim();
  if (!t || t.length < 5) return null;

  const match = REAL_DATE_START.exec(t);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const yearGiven = match[3];
  const year =
    yearGiven == null
      ? inferTransactionYear(month, stmtYear, stmtMonth)
      : yearGiven.length <= 2
        ? 2000 + parseInt(yearGiven, 10)
        : parseInt(yearGiven, 10);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  let rest = t.slice(match[0].length);
  const secondDate = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+/.exec(rest);
  if (secondDate) rest = rest.slice(secondDate[0].length);

  const lastNumber = /(-?\(?[\d,]+\.?\d*\)?|\$[\d,]+\.?\d*)\s*$/;
  const amountMatch = lastNumber.exec(rest);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (amount == null) return null;

  const merchant_raw = rest.slice(0, amountMatch.index).trim().replace(/\s+/g, " ");
  if (!merchant_raw) return null;

  return {
    date: dateStr,
    merchant_raw,
    amount,
    currency: undefined,
    exchangeRateMetadata: undefined,
  };
}

export interface ParseChaseTransactionsResult {
  transactions: ParsedTransaction[];
  failures: string[];
}

/**
 * Parse Chase transaction table from full PDF text.
 * statementYearMonth: "YYYY-MM". Attaches exchange rate lines to previous transaction. Caps at 500.
 */
export function parseChaseTransactions(
  pdfText: string,
  statementYearMonth: string
): ParseChaseTransactionsResult {
  const [stmtYearStr, stmtMonthStr] = statementYearMonth.split("-");
  const stmtYear = parseInt(stmtYearStr ?? "0", 10);
  const stmtMonth = parseInt(stmtMonthStr ?? "0", 10);
  if (!stmtYear || !stmtMonth) {
    return { transactions: [], failures: [] };
  }

  const failures: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const lines = pdfText.split(/\r?\n/).map((l) => l.trim());

  for (let i = 0; i < lines.length && transactions.length < MAX_TRANSACTIONS_PER_STATEMENT; i++) {
    const line = lines[i];
    if (isExchangeRateLine(line)) {
      if (transactions.length > 0) {
        const prev = transactions[transactions.length - 1];
        prev.exchangeRateMetadata = prev.exchangeRateMetadata
          ? `${prev.exchangeRateMetadata}; ${line}`
          : line;
      }
      continue;
    }

    if (isCurrencyOnlyFxLine(line)) {
      if (transactions.length > 0) {
        const prev = transactions[transactions.length - 1];
        prev.exchangeRateMetadata = prev.exchangeRateMetadata
          ? `${prev.exchangeRateMetadata}; ${line}`
          : line;
      }
      continue;
    }

    const tx = parseTransactionLine(line, stmtYear, stmtMonth);
    if (tx) {
      transactions.push(tx);
    } else if (line.length > 10 && isTransactionLikeForFailure(line)) {
      failures.push(`Line ${i + 1}: could not parse as transaction: ${line.slice(0, 80)}`);
    }
  }

  for (const f of failures) {
    console.error("[parseChaseTransactions]", f);
  }

  return { transactions, failures };
}
