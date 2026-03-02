/**
 * LLM classification service layer.
 * V1: Classify merchants into predefined categories; return structured JSON.
 * No logic implementation yet.
 */

export const ALLOWED_CATEGORIES = [
  "Groceries",
  "Dining & Cafes",
  "Transport",
  "Lodging",
  "Shopping",
  "Entertainment",
  "Health",
  "Fees & Interest",
  "Bills & Utilities",
  "Subscriptions",
  "Cash & Transfer",
  "Other",
] as const;

export type Category = (typeof ALLOWED_CATEGORIES)[number];

export interface ClassificationResult {
  category: Category;
  confidence: number;
  language?: string | null;
  notes?: string | null;
}

export interface ClassifyInput {
  merchant_raw: string;
  amount: number;
  currency?: string;
  countryOrCity?: string;
}

export async function classifyTransaction(
  _input: ClassifyInput
): Promise<ClassificationResult> {
  // Stub: call LLM, parse JSON, validate against ALLOWED_CATEGORIES
  return {
    category: "Other",
    confidence: 0,
    language: null,
    notes: null,
  };
}

export function getCachedClassification(
  _normalizedMerchant: string
): Promise<ClassificationResult | null> {
  // Stub: lookup cache (e.g. DB or in-memory)
  return Promise.resolve(null);
}
