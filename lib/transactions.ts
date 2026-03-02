/**
 * Transaction processing service.
 * V1: Orchestrate parse → classify → store; handle duplicates and overrides.
 * No logic implementation yet.
 */

import type { ParsedTransaction } from "./parser";

export interface ProcessedTransaction extends ParsedTransaction {
  category: string;
  confidence: number;
  needsReview?: boolean;
  lowConfidence?: boolean;
}

export interface ProcessStatementInput {
  statementYear: number;
  statementMonth: number;
  parsedTransactions: ParsedTransaction[];
}

export interface ProcessStatementResult {
  processed: ProcessedTransaction[];
  needsReview: ProcessedTransaction[];
  errors: string[];
}

export async function processStatement(
  _input: ProcessStatementInput
): Promise<ProcessStatementResult> {
  // Stub: for each transaction: classify (with cache), map to ProcessedTransaction, store in Postgres
  return { processed: [], needsReview: [], errors: [] };
}

export async function getTransactionsForMonth(
  _year: number,
  _month: number
): Promise<ProcessedTransaction[]> {
  // Stub: read from DB
  return [];
}

export async function saveProcessedTransactions(
  _year: number,
  _month: number,
  _transactions: ProcessedTransaction[]
): Promise<void> {
  // Stub: upsert into Postgres
}
