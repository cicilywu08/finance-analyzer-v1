/**
 * Financial indicators & insights (Feature 5). Category classification and pure helpers.
 */

/** Essentials = rent (from settings), groceries, transport, health, bills. */
export const ESSENTIAL_CATEGORIES = new Set([
  "Groceries",
  "Transport",
  "Health",
  "Bills & Utilities",
]);

/** Discretionary = dining, entertainment, shopping, travel (Lodging). */
export const DISCRETIONARY_CATEGORIES = new Set([
  "Dining & Cafes",
  "Entertainment",
  "Shopping",
  "Lodging",
  "Subscriptions",
]);

/** Categories that count toward essentials vs discretionary; others (Fees & Interest, Cash & Transfer, Other, Uncategorized) are "Other". */
export function isEssential(category: string): boolean {
  return ESSENTIAL_CATEGORIES.has(category);
}

export function isDiscretionary(category: string): boolean {
  return DISCRETIONARY_CATEGORIES.has(category);
}

/** Standard deviation of an array of numbers. */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/** Mean of an array of numbers. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Spike threshold: category is a "spike" if current >= (1 + threshold) * rollingAvg. Default 0.2 = 20% increase. */
export const SPIKE_INCREASE_THRESHOLD = 0.2;

export function isSpike(current: number, rollingAvg: number, threshold: number = SPIKE_INCREASE_THRESHOLD): boolean {
  if (rollingAvg <= 0) return false;
  return current >= rollingAvg * (1 + threshold);
}
