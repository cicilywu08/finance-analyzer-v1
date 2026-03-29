/**
 * OpenAI-based transaction category classifier. Uses OPENAI_API_KEY.
 * Dependency: openai SDK — minimal choice for typed responses, response_format: json_object, and consistent errors.
 */

import OpenAI from "openai";

const ALLOWED_CATEGORIES = [
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
  "Card Payment",
  "Other",
] as const;

export type Category = (typeof ALLOWED_CATEGORIES)[number];

const CATEGORIES_STR = ALLOWED_CATEGORIES.join(", ");
const MAX_BATCH_SIZE = 20;

export interface TransactionForClassify {
  id: number;
  merchant_raw: string;
  amount: number;
  transaction_date: string;
  exchange_rate_metadata?: string | null;
}

export interface ClassifyResultItem {
  id: number;
  category: string;
  confidence: number;
  notes?: string;
}

const SYSTEM_PROMPT = `You are a financial transaction classifier. Return ONLY valid JSON, no other text.
Output format (strict):
{ "results": [ { "id": "<transaction id string>", "category": "<one of: ${CATEGORIES_STR}>", "confidence": <0.0-1.0>, "notes": "<optional, max 12 words>" } ] }
Rules: Use only the categories listed. Confidence 0-1. Id must match each input id.
Anything named "AUTOMATIC PAYMENT" (including "AUTOMATIC PAYMENT - THANK YOU", "AUTOMATIC PAYMENT THANK YOU") or where the merchant/description is clearly a card payment (e.g. PAYMENT, THANK YOU, PAYMENT THANK YOU) MUST be categorized as "Card Payment" only — never Fees & Interest, Other, or any other category.`;

function buildUserPrompt(items: TransactionForClassify[]): string {
  const lines = items.map(
    (t) =>
      `id=${t.id} | merchant=${t.merchant_raw} | amount=${t.amount} | date=${t.transaction_date}${t.exchange_rate_metadata ? ` | fx=${t.exchange_rate_metadata}` : ""}`
  );
  return "Classify these transactions:\n" + lines.join("\n");
}

const REPAIR_PROMPT = `Your previous response was invalid JSON. Return ONLY a valid JSON object with the same "results" array format: { "results": [ { "id", "category", "confidence", "notes" } ] }. No markdown, no explanation.`;

function parseResponse(text: string, ids: number[]): ClassifyResultItem[] {
  const trimmed = text.trim().replace(/^```json?\s*|\s*```$/g, "");
  const parsed = JSON.parse(trimmed) as { results?: Array<{ id: string; category: string; confidence: number; notes?: string }> };
  if (!parsed?.results || !Array.isArray(parsed.results)) {
    throw new Error("Missing results array");
  }
  const idSet = new Set(ids.map(String));
  const out: ClassifyResultItem[] = [];
  for (const r of parsed.results) {
    const id = typeof r.id === "number" ? r.id : parseInt(String(r.id), 10);
    if (!idSet.has(String(r.id)) && !idSet.has(String(id))) continue;
    let category = (r.category ?? "Other").trim();
    if (!ALLOWED_CATEGORIES.includes(category as Category)) category = "Other";
    const confidence = typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0;
    out.push({
      id: typeof r.id === "number" ? r.id : parseInt(String(r.id), 10),
      category,
      confidence,
      notes: r.notes && String(r.notes).slice(0, 80),
    });
  }
  return out;
}

/**
 * Classify a batch of transactions (max 20) via OpenAI. Returns one result per input id.
 * On parse failure, retries once with repair prompt; then returns Other/0 for missing.
 */
export async function classifyBatch(
  transactions: TransactionForClassify[]
): Promise<ClassifyResultItem[]> {
  if (transactions.length === 0) return [];
  if (transactions.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size must be <= ${MAX_BATCH_SIZE}`);
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey: key });
  const ids = transactions.map((t) => t.id);

  let raw: string;
  try {
    const comp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(transactions) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    raw = comp.choices[0]?.message?.content ?? "";
  } catch (e) {
    throw new Error(`OpenAI API error: ${e instanceof Error ? e.message : String(e)}`);
  }

  let parsed: ClassifyResultItem[];
  try {
    parsed = parseResponse(raw, ids);
  } catch {
    try {
      const retry = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(transactions) },
          { role: "assistant", content: raw },
          { role: "user", content: REPAIR_PROMPT },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });
      const retryRaw = retry.choices[0]?.message?.content ?? "";
      parsed = parseResponse(retryRaw, ids);
    } catch {
      return ids.map((id) => ({ id, category: "Other", confidence: 0 }));
    }
  }

  const byId = new Map(parsed.map((p) => [p.id, p]));
  const result = ids.map((id) => byId.get(id) ?? { id, category: "Other", confidence: 0 });

  const cardPaymentPattern = /AUTOMATIC\s+PAYMENT|PAYMENT\s*[- ]\s*THANK\s+YOU|^\s*THANK\s+YOU\s*$/i;
  const withOverride = result.map((r) => {
    const tx = transactions.find((t) => t.id === r.id);
    if (tx && cardPaymentPattern.test(tx.merchant_raw.trim())) {
      return { ...r, category: "Card Payment", confidence: 1 };
    }
    return r;
  });
  return withOverride;
}
