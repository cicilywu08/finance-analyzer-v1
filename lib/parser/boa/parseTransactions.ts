/**
 * Bank of America statement transaction parser.
 * Supports:
 * - One line: MM/DD/YY  Description  Amount (e.g. 09/16/25  VENMO PPD ...  2,516.77)
 * - Multi-line table: line1 = date only, line2 = description, line3 = amount.
 * statementYearMonth (YYYY-MM) used for year inference when only MM/DD given.
 */

import type { ParsedTransaction } from "../types";
import { parseAmount } from "../utils";

const MAX_TRANSACTIONS_PER_STATEMENT = 500;

/** MM/DD or MM/DD/YY or MM/DD/YYYY at start of line */
const DATE_START = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2,4}))?\s+/;
/** Line that is only a date (MM/DD/YY or MM/DD/YYYY), optional trailing space */
const DATE_ONLY_LINE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2,4}))?\s*$/;

/** Amount-like at end of string (negative or positive with optional commas). */
const AMOUNT_AT_END = /(-?[\d,]+\.\d{2})\s*$/;
/** Any amount-like token (for finding last amount on line). */
const AMOUNT_TOKEN = /(-?[\d,]+\.\d{2})/g;

function inferTransactionYear(
  txnMonth: number,
  stmtYear: number,
  stmtMonth: number
): number {
  return txnMonth <= stmtMonth ? stmtYear : stmtYear - 1;
}

function normalizeYear(y: number): number {
  if (y >= 0 && y < 100) return 2000 + y;
  return y;
}

function buildDateStr(
  month: number,
  day: number,
  yearGiven: string | undefined,
  stmtYear: number,
  stmtMonth: number
): string {
  const year =
    yearGiven == null
      ? inferTransactionYear(month, stmtYear, stmtMonth)
      : yearGiven.length <= 2
        ? 2000 + parseInt(yearGiven, 10)
        : normalizeYear(parseInt(yearGiven, 10));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse one line: date at start, amount at end (or last amount-like token). */
function parseTransactionLine(
  line: string,
  stmtYear: number,
  stmtMonth: number
): ParsedTransaction | null {
  const t = line.trim();
  if (!t || t.length < 5) return null;

  const match = DATE_START.exec(t);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const yearGiven = match[3];
  const dateStr = buildDateStr(month, day, yearGiven, stmtYear, stmtMonth);

  let rest = t.slice(match[0].length).trim();
  // Prefer amount at end; if not, take last amount-like token (handles trailing junk).
  let amountMatch = AMOUNT_AT_END.exec(rest);
  if (!amountMatch) {
    const tokens = [...rest.matchAll(AMOUNT_TOKEN)];
    if (tokens.length === 0) return null;
    amountMatch = tokens[tokens.length - 1];
  }
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

/** Parse multi-line row: line i = date only, i+1 = description, i+2 = amount. */
function parseMultilineRow(
  dateLine: string,
  descLine: string,
  amountLine: string,
  stmtYear: number,
  stmtMonth: number
): ParsedTransaction | null {
  const dm = DATE_ONLY_LINE.exec(dateLine.trim());
  if (!dm) return null;
  const month = parseInt(dm[1], 10);
  const day = parseInt(dm[2], 10);
  const yearGiven = dm[3];
  const amount = parseAmount(amountLine.trim());
  if (amount == null) return null;
  const desc = descLine.trim().replace(/\s+/g, " ");
  if (!desc) return null;
  const dateStr = buildDateStr(month, day, yearGiven, stmtYear, stmtMonth);
  return {
    date: dateStr,
    merchant_raw: desc,
    amount,
    currency: undefined,
    exchangeRateMetadata: undefined,
  };
}

export interface ParseBoaTransactionsResult {
  transactions: ParsedTransaction[];
  failures: string[];
}

export function parseBoaTransactions(
  pdfText: string,
  statementYearMonth: string
): ParseBoaTransactionsResult {
  const [stmtYearStr, stmtMonthStr] = statementYearMonth.split("-");
  const stmtYear = parseInt(stmtYearStr ?? "0", 10);
  const stmtMonth = parseInt(stmtMonthStr ?? "0", 10);
  if (!stmtYear || !stmtMonth) {
    return { transactions: [], failures: [] };
  }

  const failures: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const lines = pdfText.split(/\r?\n/).map((l) => l.trim());

  function skipLine(l: string): boolean {
    if (!l) return true;
    if (/^(date|posting|transaction|description|amount|balance)\s*$/i.test(l)) return true;
    if (/Page\s+\d+\s+of\s+\d+/i.test(l)) return true;
    if (/^Total\s+/i.test(l)) return true;
    if (/^(Deposits and other additions|Withdrawals and other subtractions|Service fees)\s*$/i.test(l)) return true;
    return false;
  }

  function isAmountOnlyLine(l: string): boolean {
    return parseAmount(l) !== null && /^-?[\d,]+\.\d{2}\s*$/.test(l.trim());
  }

  for (let i = 0; i < lines.length && transactions.length < MAX_TRANSACTIONS_PER_STATEMENT; i++) {
    const line = lines[i];
    if (skipLine(line)) continue;

    // Multi-line: date only → description → amount
    if (DATE_ONLY_LINE.test(line) && lines[i + 1] !== undefined && lines[i + 2] !== undefined) {
      const desc = lines[i + 1].trim();
      const amtLine = lines[i + 2].trim();
      if (desc && isAmountOnlyLine(amtLine)) {
        const tx = parseMultilineRow(line, lines[i + 1], amtLine, stmtYear, stmtMonth);
        if (tx) {
          transactions.push(tx);
          i += 2;
          continue;
        }
      }
    }

    const tx = parseTransactionLine(line, stmtYear, stmtMonth);
    if (tx) {
      transactions.push(tx);
    } else if (line.length > 15 && DATE_START.test(line)) {
      failures.push(`Line ${i + 1}: could not parse: ${line.slice(0, 80)}`);
    }
  }

  return { transactions, failures };
}
