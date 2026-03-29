/**
 * American Express statement transaction parser.
 * Supports:
 * - One line: MM/DD/YY  Description  $Amount or -$Amount
 * - Multi-line: line1 = date only (MM/DD/YY), then one or more description lines, then a line that is only an amount (-$X.XX or $X.XX).
 * statementYearMonth (YYYY-MM) used for year inference when only MM/DD given.
 */

import type { ParsedTransaction } from "../types";
import { parseAmount } from "../utils";

const MAX_TRANSACTIONS_PER_STATEMENT = 500;

/** MM/DD/YY or MM/DD/YYYY at start of line (optional space after for PDFs that concatenate) */
const DATE_START = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{2,4})\s*/;
/** Line that is only a date (MM/DD/YY or MM/DD/YYYY) */
const DATE_ONLY_LINE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{2,4})\s*$/;
/** Amex amounts: -$X.XX or $X.XX (optional comma thousands) */
const AMOUNT_ONLY_LINE = /^-?\$[\d,]+\.\d{2}\s*$/;
/** Find last $ amount on a line */
const AMOUNT_DOLLAR = /(-?\$[\d,]+\.\d{2})/g;

function normalizeYear(y: number): number {
  if (y >= 0 && y < 100) return 2000 + y;
  return y;
}

function buildDateStr(
  month: number,
  day: number,
  yearGiven: string,
  stmtYear: number,
  stmtMonth: number
): string {
  const year =
    yearGiven.length <= 2
      ? 2000 + parseInt(yearGiven, 10)
      : normalizeYear(parseInt(yearGiven, 10));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse one line: date at start, $ amount somewhere (use last occurrence). */
function parseTransactionLine(
  line: string,
  stmtYear: number,
  stmtMonth: number
): ParsedTransaction | null {
  const t = line.trim();
  if (!t || t.length < 10) return null;

  const match = DATE_START.exec(t);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const yearGiven = match[3];
  const dateStr = buildDateStr(month, day, yearGiven, stmtYear, stmtMonth);

  const rest = t.slice(match[0].length).trim();
  const amountMatches = [...rest.matchAll(AMOUNT_DOLLAR)];
  if (amountMatches.length === 0) return null;
  const lastAmount = amountMatches[amountMatches.length - 1];
  const amount = parseAmount(lastAmount[1]);
  if (amount == null) return null;

  const merchant_raw = rest.slice(0, lastAmount.index).trim().replace(/\s+/g, " ");
  if (!merchant_raw) return null;

  return {
    date: dateStr,
    merchant_raw,
    amount,
    currency: undefined,
    exchangeRateMetadata: undefined,
  };
}

/** Parse multi-line row: line i = date only, i+1..i+k = description, i+k+1 = amount line. */
function parseMultilineRow(
  dateLine: string,
  descLines: string[],
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
  const desc = descLines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
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

export interface ParseAmexTransactionsResult {
  transactions: ParsedTransaction[];
  failures: string[];
}

export function parseAmexTransactions(
  pdfText: string,
  statementYearMonth: string
): ParseAmexTransactionsResult {
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
    if (/^p\.\s*\d+\/\d+/i.test(l)) return true;
    if (/^Page\s+\d+/i.test(l)) return true;
    if (/Continued on/i.test(l)) return true;
    if (/^(Summary|Detail)\s*$/i.test(l)) return true;
    if (/Canadian Dollars\s*$/i.test(l)) return true;
    if (/^[\d,]+\.\d{2}\s*$/.test(l) && !l.startsWith("$") && !l.startsWith("-")) return true;
    return false;
  }

  for (let i = 0; i < lines.length && transactions.length < MAX_TRANSACTIONS_PER_STATEMENT; i++) {
    const line = lines[i];
    if (skipLine(line)) continue;

    // Multi-line: date only → one or more description lines → amount-only line
    if (DATE_ONLY_LINE.test(line)) {
      const descLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !AMOUNT_ONLY_LINE.test(lines[j]) && !DATE_ONLY_LINE.test(lines[j])) {
        if (lines[j] && !skipLine(lines[j])) descLines.push(lines[j]);
        j++;
      }
      if (j < lines.length && AMOUNT_ONLY_LINE.test(lines[j]) && descLines.length > 0) {
        const tx = parseMultilineRow(line, descLines, lines[j], stmtYear, stmtMonth);
        if (tx) {
          transactions.push(tx);
          i = j;
          continue;
        }
      }
    }

    const tx = parseTransactionLine(line, stmtYear, stmtMonth);
    if (tx) {
      transactions.push(tx);
    } else if (line.length > 12 && DATE_START.test(line)) {
      failures.push(`Line ${i + 1}: could not parse: ${line.slice(0, 80)}`);
    }
  }

  return { transactions, failures };
}
