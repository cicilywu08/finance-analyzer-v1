/**
 * LLM-based financial advisor insights. Uses OPENAI_API_KEY.
 */

import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a thoughtful financial analyst and behavioral finance advisor.
Your goal is to provide realistic, balanced, non-judgmental insights.
Do NOT give generic advice like "save more money" or "cut expenses".
Do NOT assume the user wants to minimize travel.
Account for lifestyle context before evaluating spending.`;

export interface AdvisorInput {
  income: number | null;
  total_spend: number;
  savings_rate: number | null;
  essentialsBreakdown: Array<{ category: string; amount: number }>;
  discretionaryBreakdown: Array<{ category: string; amount: number }>;
  otherBreakdown: Array<{ category: string; amount: number }>;
  topMerchants: Array<{ merchant_raw: string; total_spend: number }>;
}

function formatBreakdown(items: Array<{ category: string; amount: number }>): string {
  if (items.length === 0) return "None";
  return items.map((r) => `${r.category}: ${r.amount.toFixed(2)}`).join("\n");
}

function formatTopMerchants(items: Array<{ merchant_raw: string; total_spend: number }>): string {
  if (items.length === 0) return "None";
  return items.map((r) => `${r.merchant_raw}: ${r.total_spend.toFixed(2)}`).join("\n");
}

export function buildAdvisorUserPrompt(input: AdvisorInput): string {
  const incomeStr = input.income != null ? String(input.income) : "Not set";
  const savingsRateStr =
    input.savings_rate != null ? `${(input.savings_rate * 100).toFixed(1)}%` : "N/A";
  return `Here is a monthly financial snapshot:

Age: 29
Lifestyle: Remote professional, travel-oriented, spends extended time living abroad while working (not vacation-only travel).
Income (monthly): ${incomeStr}

Monthly total spend: ${input.total_spend.toFixed(2)}
Savings rate: ${savingsRateStr}

Category breakdown:

Essentials:
${formatBreakdown(input.essentialsBreakdown)}

Discretionary:
${formatBreakdown(input.discretionaryBreakdown)}

Other:
${formatBreakdown(input.otherBreakdown)}

Top merchants:
${formatTopMerchants(input.topMerchants)}

Instructions:

Evaluate whether this spending structure is reasonable for:

A 29-year-old professional

Income level roughly comparable

Travel-heavy lifestyle

Remote worker

Compare proportionally (percent-based), not absolute dollars.

If travel-related categories (e.g., Lodging, Flights, Airbnb) are high,
interpret within the context of temporary relocation or travel living,
not luxury vacation spending.

Identify:

Any imbalances

Any structural risks

Any unusually concentrated spending patterns

Provide:

3–5 structured insights

2–3 practical recommendations (behaviorally realistic)

1 forward-looking projection comment (if this pattern continues)

Benchmarking and comparison (important):

- When you mention a percentage (e.g. essentials as % of income), add brief context: how does this compare to typical ranges? E.g. "Essentials at 30.9% of income is in line with / below / above the 30–40% range common for single professionals" or "Rent as % of income is typical for [group]."
- For travel-related spending (lodging, dining while traveling): add context on what digital nomads or remote tech workers typically spend when relevant. E.g. "Digital nomads in tech often allocate X–Y% to lodging and travel; your Z% is ..." or "Your lodging spend is comparable to / higher than norms for remote workers who relocate frequently." Use reasonable estimates or ranges if you don't have exact data; the goal is to give the user a sense of how they compare to similar people.
- Keep benchmarking concise (1–2 sentences per metric) and avoid vague claims; prefer "in line with," "below typical," or "above typical" with a rough range where possible.

Keep tone analytical but supportive. Avoid moral judgment.

Output format (critical): Write each section exactly once. Do NOT repeat the same content under multiple headers. Each block below must contain ONLY that section's content—no other section's text.

Summary:
(2–4 sentences only; do not include the other sections here)

Spending Balance Analysis:
(only this section; include benchmarking vs typical ranges and, for travel/lodging, vs digital nomads or remote tech workers where relevant)

Behavioral Observations:
(only this section)

Recommendations:
(only this section)

Forward Outlook:
(only this section; 1–2 sentences)`;
}

export interface AdvisorSections {
  summary: string;
  spendingBalanceAnalysis: string;
  behavioralObservations: string;
  recommendations: string;
  forwardOutlook: string;
}

const SECTION_KEYS: (keyof AdvisorSections)[] = [
  "summary",
  "spendingBalanceAnalysis",
  "behavioralObservations",
  "recommendations",
  "forwardOutlook",
];

const SECTION_HEADERS: Record<keyof AdvisorSections, string> = {
  summary: "Summary",
  spendingBalanceAnalysis: "Spending Balance Analysis",
  behavioralObservations: "Behavioral Observations",
  recommendations: "Recommendations",
  forwardOutlook: "Forward Outlook",
};

/** Escape header text for use in regex. */
function escapeHeader(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a section header with optional markdown (e.g. "Summary:" or "**Summary:**" or "**Spending Balance Analysis:**").
 * Use with flag "i" for case-insensitive.
 */
function sectionHeaderPattern(header: string): string {
  const esc = escapeHeader(header);
  return `(?:^|\\n)\\s*(?:\\*\\*)?\\s*${esc}\\s*(?:\\*\\*)?\\s*:\\s*`;
}

/** Parse LLM response into sections by known headers. Handles **Header:** style. */
export function parseAdvisorResponse(raw: string): AdvisorSections {
  const result: AdvisorSections = {
    summary: "",
    spendingBalanceAnalysis: "",
    behavioralObservations: "",
    recommendations: "",
    forwardOutlook: "",
  };
  for (let i = 0; i < SECTION_KEYS.length; i++) {
    const key = SECTION_KEYS[i];
    const header = SECTION_HEADERS[key];
    const nextKey = i + 1 < SECTION_KEYS.length ? SECTION_KEYS[i + 1] : null;
    const nextHeader = nextKey ? SECTION_HEADERS[nextKey] : null;

    const startRe = new RegExp(sectionHeaderPattern(header), "im");
    const startMatch = raw.match(startRe);
    const start = startMatch && startMatch.index != null ? startMatch.index + startMatch[0].length : 0;
    let end = raw.length;
    if (nextHeader) {
      const nextRe = new RegExp(sectionHeaderPattern(nextHeader), "im");
      const nextMatch = raw.slice(start).match(nextRe);
      if (nextMatch && nextMatch.index != null) end = start + nextMatch.index;
    }
    result[key] = raw.slice(start, end).trim();
  }
  return result;
}

/**
 * Call OpenAI to generate advisor insights. Returns parsed sections.
 */
export async function getAdvisorInsights(input: AdvisorInput): Promise<AdvisorSections> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey: key });
  const userContent = buildAdvisorUserPrompt(input);

  const comp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
  });

  const raw = comp.choices[0]?.message?.content ?? "";
  return parseAdvisorResponse(raw);
}
