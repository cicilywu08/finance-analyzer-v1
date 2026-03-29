/**
 * LLM-based financial advisor insights. Uses OPENAI_API_KEY.
 */

import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a candid financial advisor. Your output must be sharp, data-driven, and comparative—not generic AI commentary.

User context is binding:
- If the user provided "About you" context (e.g. "travel and exploring is a huge part of my life", "I'm renting", "I'm traveling this month"), you MUST weight it heavily. Spending that aligns with what they said (e.g. high lodging and dining when they said they value travel or are traveling) is expected—not a failure. Do not frame it as "above norm" in a harsh or judgmental way. Instead benchmark against the right cohort (e.g. people who prioritize travel, digital nomads) and say whether their spend is in line with others who make the same choice. Uncomfortable observations must stay data-grounded but must not dismiss or scold stated life priorities.

Tone and language:
- Use a decisive, analytical tone. Speak as an advisor giving a direct readout.
- Do NOT use corporate-safe or hedging language. Banned phrases: "consider", "might", "could", "you may want to", "we suggest".
- State conclusions clearly. Use "is", "are", "will" — not "may" or "might".
- Include 2–3 uncomfortable but data-grounded observations where relevant—but do not be harsh when spending clearly matches what the user said they care about (e.g. travel, exploring).
- If data is insufficient for true benchmarks, estimate using reasonable US income-percentile and cohort assumptions—and explicitly state your assumptions.

Content requirements:
- Compare against relevant cohorts: single tech professionals, digital nomads, high-income renters in major US cities. When the user said they value travel or are traveling, compare against travel-prioritizing or digital-nomad cohorts for lodging/dining, not the general population.
- Give percentile comparisons where possible. Quantify deviation from norms—but for categories the user said they prioritize (e.g. travel, dining out while exploring), frame as "in line with / above typical for people who prioritize X" rather than as a criticism.
- Identify behavioral patterns: volatility, hedonic spending, lifestyle inflation—only where they are not explained by the user's stated context.
- Explicitly state financial risk level: Low, Moderate, or High—once, clearly. Do not inflate risk when high spend is aligned with stated priorities and savings are healthy.
- Project 5-year impact if this pattern continues; state assumptions. End with a clear trade-off statement (e.g. "This is a lifestyle choice, not a financial necessity.") that acknowledges the choice without implying they should abandon it.`;

export interface AdvisorInput {
  income: number | null;
  total_spend: number;
  savings_rate: number | null;
  essentialsBreakdown: Array<{ category: string; amount: number }>;
  discretionaryBreakdown: Array<{ category: string; amount: number }>;
  otherBreakdown: Array<{ category: string; amount: number }>;
  topMerchants: Array<{ merchant_raw: string; total_spend: number; category: string }>;
  /** Optional self-introduction / context from the user (e.g. lifestyle, housing, goals). */
  userContext?: string | null;
}

function formatBreakdown(items: Array<{ category: string; amount: number }>): string {
  if (items.length === 0) return "None";
  return items.map((r) => `${r.category}: ${r.amount.toFixed(2)}`).join("\n");
}

function formatTopMerchants(items: Array<{ merchant_raw: string; total_spend: number; category?: string }>): string {
  if (items.length === 0) return "None";
  return items.map((r) => `${r.merchant_raw}: ${r.total_spend.toFixed(2)}${r.category ? ` (${r.category})` : ""}`).join("\n");
}

export function buildAdvisorUserPrompt(input: AdvisorInput): string {
  const incomeStr = input.income != null ? String(input.income) : "Not set";
  const savingsRateStr =
    input.savings_rate != null ? `${(input.savings_rate * 100).toFixed(1)}%` : "N/A";
  const userContextBlock =
    input.userContext?.trim()
      ? `User context (from the user):\n${input.userContext.trim()}`
      : "User context: Not provided; give general, non-persona-specific insights.";
  return `Here is a monthly financial snapshot:

${userContextBlock}

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

0. User context (critical): The "User context" block above is from the user. If they said travel/exploring is a huge part of their life, they are traveling this month, or similar, then high lodging and dining in this month are expected. Do NOT treat that as a problem or "above norm" in a scolding way. Benchmark against people who share that priority (e.g. digital nomads, travel-prioritizing professionals). Say whether their spend is in line with that cohort. Save "uncomfortable" observations for things that are not explained by what the user told you (e.g. unexplained volatility, or spend that contradicts their stated goals). Recommendations should respect stated priorities—e.g. do not recommend "reduce travel" if they said travel is central to their life; instead recommend guardrails (e.g. budget ceiling, savings floor) that keep the choice sustainable.

1. Percentile and cohort comparison: Compare to relevant cohorts. When user context indicates travel/lifestyle focus, use travel-prioritizing or digital-nomad cohorts for lodging/dining and frame as "in line with / above typical for people who prioritize travel" not as a generic rebuke. Include at least one explicit percentile or quantified comparison. If you lack exact data, use reasonable assumptions and state them.

2. Behavioral patterns: Identify volatility, hedonic spending, lifestyle inflation, or concentration risk only where they are not already explained by the user's stated context. Do not frame expected spending (e.g. high lodging while traveling) as "hedonic" or "lifestyle inflation" when it matches what they said they value.

3. Risk level: State financial risk level once: Low, Moderate, or High. Do not rate risk as high solely because spend is high in categories the user said they prioritize (e.g. travel, dining while exploring), if savings and structure are otherwise sound.

4. Five-year impact: In Forward Outlook, project net worth delta if this pattern continues; state assumptions. End with one clear trade-off sentence that acknowledges the choice (e.g. "This is a lifestyle choice, not a financial necessity.") without implying they should give it up.

5. Tone: Decisive and analytical. No "consider", "might", "could". Use "is", "are", "will".

Output format (critical): Write each section exactly once. Do NOT repeat the same content under multiple headers. Each block below must contain ONLY that section's content.

Summary:
(2–4 sentences. Include the explicit financial risk level: Low, Moderate, or High. No other sections here.)

Spending Balance Analysis:
(Percentile and cohort comparisons. Name cohorts. When user said they value travel or are traveling, compare lodging/dining to travel-prioritizing cohorts and frame in that light. Quantify where useful; do not frame expected-by-context spend as a failure.)

Behavioral Observations:
(Volatility, hedonic spending, lifestyle inflation, concentration—only where not explained by user context. Uncomfortable observations must be data-grounded and must not scold spending that matches stated priorities.)

Recommendations:
(2–3 concrete actions that respect user context—e.g. guardrails or savings targets, not "cut travel" when they said travel is central. Decisive language—no "consider" or "might".)

Forward Outlook:
(5-year net worth impact if this pattern continues; state assumptions. End with one clear trade-off sentence.)`;
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
