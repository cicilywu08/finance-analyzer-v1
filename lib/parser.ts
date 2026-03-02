/**
 * PDF parser service layer.
 * V1: Extract text via pdf-parse; detect statement period (regex + LLM stub).
 */

// pdf-parse: minimal PDF text extraction (CJS). No OCR; empty text = scanned/unsupported.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{
  text: string;
  numpages: number;
  info?: unknown;
}>;

/** Min length to consider PDF text-based (not scanned). */
const MIN_EXTRACTABLE_LENGTH = 50;

export interface ParsedStatementMeta {
  year: number;
  month: number;
  rawPeriod?: string;
}

export type DetectionSource =
  | "closing_date"
  | "period_range"
  | "statement_date"
  | "due_date"
  | "payment_due_date_fallback_adjusted"
  | "llm_stub"
  | "none";

export interface DetectStatementResult {
  year: number | null;
  month: number | null;
  detectionSource: DetectionSource;
  matchedText: string | null;
}

export type { ParsedTransaction } from "./parser/types";

/**
 * Extract text from PDF buffer. Uses pdf-parse (full document).
 * For header-only use (e.g. statement period), use first 1–2 pages worth via text.slice(0, N).
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; isScanned: boolean }> {
  try {
    const data = await pdfParse(buffer);
    const text = (data?.text ?? "").trim();
    if (!text || text.length < MIN_EXTRACTABLE_LENGTH) {
      return { text: "", isScanned: true };
    }
    return { text: data.text, isScanned: false };
  } catch {
    return { text: "", isScanned: true };
  }
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** 2-digit year → 20YY (e.g. 26 → 2026). */
function normalizeYear(year: number): number {
  if (year >= 0 && year < 100) return 2000 + year;
  return year;
}

function parseMonthYear(month: number, year: number): ParsedStatementMeta | null {
  const y = normalizeYear(year);
  if (month >= 1 && month <= 12 && y >= 2000 && y <= 2100) {
    return { year: y, month };
  }
  return null;
}

/** One month before (statement month from payment due date). Handles year rollover: Jan → Dec previous year. */
function oneMonthBefore(year: number, month: number): { year: number; month: number } {
  let m = month - 1;
  let y = year;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return { year: y, month: m };
}

/** Detection priority: 1) Closing Date 2) Statement Date 3) Billing Cycle end date 4) Payment Due Date. Returns YYYY-MM via year/month. */
function detectYearMonthRegex(
  headerText: string
): DetectStatementResult | null {
  const t = headerText.replace(/\s+/g, " ").trim();
  const early = t.slice(0, 1500);

  // 1) Closing Date
  const closingMmDd = /(?:closing\s+date)[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(early);
  if (closingMmDd) {
    const m = parseMonthYear(parseInt(closingMmDd[1], 10), parseInt(closingMmDd[3], 10));
    if (m) return { year: m.year, month: m.month, detectionSource: "closing_date", matchedText: closingMmDd[0] };
  }
  const closingNamed = /(?:closing\s+date)[:\s]+(\w+)\s+\d{1,2},?\s+(\d{2,4})/i.exec(early);
  if (closingNamed) {
    const yearVal = parseInt(closingNamed[2], 10);
    const monthIdx = MONTH_NAMES.indexOf((closingNamed[1] ?? "").toLowerCase());
    if (monthIdx >= 0) {
      const m = parseMonthYear(monthIdx + 1, yearVal);
      if (m) return { year: m.year, month: m.month, detectionSource: "closing_date", matchedText: closingNamed[0] };
    }
  }

  // 2) Statement Date (only when label "Statement Date" is present; do not match Payment Due Date or bare dates)
  const statementMmDd = /(?:statement\s+date)[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(early);
  if (statementMmDd) {
    const m = parseMonthYear(parseInt(statementMmDd[1], 10), parseInt(statementMmDd[3], 10));
    if (m) return { year: m.year, month: m.month, detectionSource: "statement_date", matchedText: statementMmDd[0] };
  }
  const statementNamed = /(?:statement\s+date)[:\s]+(\w+)\s+\d{1,2},?\s+(\d{2,4})/i.exec(early);
  if (statementNamed) {
    const yearVal = parseInt(statementNamed[2], 10);
    const monthIdx = MONTH_NAMES.indexOf((statementNamed[1] ?? "").toLowerCase());
    if (monthIdx >= 0) {
      const m = parseMonthYear(monthIdx + 1, yearVal);
      if (m) return { year: m.year, month: m.month, detectionSource: "statement_date", matchedText: statementNamed[0] };
    }
  }

  // 3) Billing Cycle end date (use end of range: "01/01/2026 - 01/31/2026" → 2026-01)
  const periodRangeMmDd = /(?:statement\s+period|billing\s+(?:cycle|period))[:\s]+(?:\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(early);
  if (periodRangeMmDd) {
    const m = parseMonthYear(parseInt(periodRangeMmDd[1], 10), parseInt(periodRangeMmDd[3], 10));
    if (m) return { year: m.year, month: m.month, detectionSource: "period_range", matchedText: periodRangeMmDd[0] };
  }
  const periodRangeNamed = /(?:statement\s+period|billing\s+(?:cycle|period))[:\s]+(?:\w+\s+\d{1,2},?\s+\d{4}\s*[-–]\s*)?(\w+)\s+\d{1,2},?\s+(\d{2,4})/i.exec(early);
  if (periodRangeNamed) {
    const yearVal = parseInt(periodRangeNamed[2], 10);
    const monthIdx = MONTH_NAMES.indexOf((periodRangeNamed[1] ?? "").toLowerCase());
    if (monthIdx >= 0) {
      const m = parseMonthYear(monthIdx + 1, yearVal);
      if (m) return { year: m.year, month: m.month, detectionSource: "period_range", matchedText: periodRangeNamed[0] };
    }
  }

  // 4) Payment Due Date (fallback): infer statement month as one month BEFORE due date
  const dueMmDd = /(?:payment\s+)?due\s+date[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(early);
  if (dueMmDd) {
    const due = parseMonthYear(parseInt(dueMmDd[1], 10), parseInt(dueMmDd[3], 10));
    if (due) {
      const adjusted = oneMonthBefore(due.year, due.month);
      const dateOnly = `${dueMmDd[1]}/${dueMmDd[2]}/${dueMmDd[3]}`;
      return { year: adjusted.year, month: adjusted.month, detectionSource: "payment_due_date_fallback_adjusted", matchedText: dateOnly };
    }
  }
  const dueNamed = /(?:payment\s+)?due\s+date[:\s]+(\w+)\s+\d{1,2},?\s+(\d{2,4})/i.exec(early);
  if (dueNamed) {
    const yearVal = parseInt(dueNamed[2], 10);
    const monthIdx = MONTH_NAMES.indexOf((dueNamed[1] ?? "").toLowerCase());
    if (monthIdx >= 0) {
      const due = parseMonthYear(monthIdx + 1, yearVal);
      if (due) {
        const adjusted = oneMonthBefore(due.year, due.month);
        return { year: adjusted.year, month: adjusted.month, detectionSource: "payment_due_date_fallback_adjusted", matchedText: dueNamed[0] };
      }
    }
  }

  return null;
}

/** Stub: LLM-based detection (not integrated yet). */
export async function detectMonthYearWithLLM(
  _headerText: string
): Promise<ParsedStatementMeta | null> {
  return null;
}

export async function detectStatementPeriod(
  headerText: string
): Promise<DetectStatementResult> {
  const fromRegex = detectYearMonthRegex(headerText);
  if (fromRegex) return fromRegex;
  const fromLlm = await detectMonthYearWithLLM(headerText);
  if (fromLlm) {
    return {
      year: fromLlm.year,
      month: fromLlm.month,
      detectionSource: "llm_stub",
      matchedText: null,
    };
  }
  return { year: null, month: null, detectionSource: "none", matchedText: null };
}

export { parseChaseTransactions } from "./parser/chase/parseTransactions";
export type { ParseChaseTransactionsResult } from "./parser/chase/parseTransactions";

/** Inline test: "Payment Due Date:03/22/26" → detectedYearMonth "2026-02", detectionSource "payment_due_date_fallback_adjusted". */
export async function runDetectionDueDateTest(): Promise<void> {
  const headerPreview = "Payment Due Date:03/22/26";
  const r = await detectStatementPeriod(headerPreview);
  const detectedYearMonth =
    r.year != null && r.month != null
      ? `${r.year}-${String(r.month).padStart(2, "0")}`
      : null;
  if (
    detectedYearMonth !== "2026-02" ||
    r.detectionSource !== "payment_due_date_fallback_adjusted"
  ) {
    throw new Error(
      `Detection test failed: got detectedYearMonth=${detectedYearMonth}, detectionSource=${r.detectionSource}, expected 2026-02 and payment_due_date_fallback_adjusted`
    );
  }
  if (r.matchedText !== "03/22/26") {
    throw new Error(
      `Detection test failed: got matchedText=${r.matchedText}, expected "03/22/26"`
    );
  }
}
