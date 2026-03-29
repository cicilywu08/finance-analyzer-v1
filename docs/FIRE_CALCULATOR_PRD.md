# FIRE Calculator — Product Design (PRD)

**Handoff doc for Cursor / Figma Make.**  
**URL:** `/fire` · **Nav label:** FIRE Calculator

---

## 1. Page positioning

- **FIRE Calculator** = plan from **real spending data** (Summary / Monthly) → target FIRE number + path + risk + insights.
- Not a standalone calculator: **defaults** from app data (Summary avg spend, Settings income), user can **override** assumptions.
- **Output:** target FIRE number, path, risk band, actionable insights.

---

## 2. Information architecture (3 regions)

### A. Inputs Panel (left or top card)

Four groups. **Default values** from app data where possible. **Label “Using app data”** next to any field that is pre-filled from Summary/Settings.

| Group | Fields | Required | Default source |
|-------|--------|----------|----------------|
| **1) Profile** | Current age | Yes | — |
| | Target FIRE age (or year) | Yes | — |
| | Location / tax mode | No | Toggle: “Ignore taxes” / “Basic tax assumption” |
| **2) Current Assets** | Investable assets (brokerage + 401k + IRA + cash to invest) | Yes | — |
| | Cash emergency fund | No | Used for risk / runway |
| | Expected one-time inflow/outflow | No | e.g. bonus, home purchase |
| **3) Income & Savings** | Current annual income | Yes | Settings default monthly income × 12 |
| | Current monthly savings | No | If empty: infer as income − avg monthly spend |
| | Expected income growth % | No | 2% |
| **4) Spending Assumptions** | Baseline monthly spend | Yes | **Summary** avg monthly spend |
| | Retirement monthly spend multiplier | No | 0.8x / 1.0x / 1.2x (default 1.0) |
| | Inflation % | No | 2.5% |
| | Safe withdrawal rate (SWR) | No | 4% (options 3% / 3.5% / 4%) |
| | Investment return % (real or nominal) | No | 6–7%, label assumption clearly |

**UI rule:** Every input that is filled from app data shows a small tag: **“Using app data”**.

---

### B. Calculate CTA

- **Primary button:** “Calculate FIRE Plan”.
- After first run: if user changes any input → show “Unsaved changes” hint and change button to **“Recalculate”** (or highlight).
- **V1:** no auto-calc; button-driven only.

---

### C. Results Dashboard (right or below)

**Style:** “Apple Health” summary — big number, short explanation, 2–3 visuals.

#### Result Hero (top card)

- **FIRE Number** (target investable assets).
- **Years to FIRE** (at current plan) — or **On track** / **Off track**.
- **Required monthly savings** (to hit target age).
- Footnote: “Based on SWR, return, inflation assumptions.”

#### Core metrics (cards or list)

- Avg monthly spend (baseline), annualized spend.
- Current investable assets, FIRE number, progress (current / FIRE number).
- Years to target, required monthly savings vs current.
- Current plan outcome: projected FIRE age / on track or not.

#### Optional visuals

1. **Asset growth curve** (line chart): x = time (months/years), y = assets; lines: “Current plan” vs “Required plan”.
2. **FIRE number progress bar:** current_assets / fire_number.
3. **Sensitivity cards:** “Spend −10% → FIRE −X years”, “Save +$500/mo → −Y years”, “SWR 3.5% vs 4% → required assets +$Z”.

#### Insights (differentiators)

- **Insight 1:** “Based on your **actual spend**, your FIRE number is $X. That’s [±Y%] vs your self-estimate.” (if user had a self-estimate).
- **Insight 2:** Top levers (sensitivity): spend −10%, savings +$500/mo, SWR 3.5% vs 4%.

---

## 3. Metrics (formulas & sources)

### V1 required

| # | Metric | Formula / source |
|---|--------|-------------------|
| 1 | **Avg monthly spend (baseline)** | Summary `lifetime.avgMonthlySpend`; user can override |
| 2 | **Annualized spend** | `avg_monthly_spend × 12` |
| 3 | **FIRE number** | `annual_retirement_spend / SWR` where `annual_retirement_spend = annualized_spend × retirement_multiplier` |
| 4 | **Current investable assets** | User input |
| 5 | **Years to target** | `target_FIRE_age − current_age` (or from target year) |
| 6 | **Future value projection** | Compound growth: `FV = PV(1+r)^n + PMT × [((1+r)^n − 1)/r]` (monthly r, n months) |
| 7 | **Required monthly savings** | Solve for PMT so FV at target date ≥ FIRE number |
| 8 | **Current plan outcome** | Using current/estimated monthly savings → projected FIRE age or “On track by target age” / “Off track” |

### Strongly recommended (V1)

| # | Metric | Formula / source |
|---|--------|-------------------|
| 9 | **Savings rate (today)** | `current_monthly_savings / monthly_income`; if no savings input: `(income − avg_spend) / income` |
| 10 | **Runway / safety buffer** | `emergency_fund_months = emergency_cash / avg_monthly_spend`; show warning if &lt; 3–6 months |
| 11 | **Spend volatility risk** | Summary `savingsStability.savingsRateStdDev` or spend std dev → “Stability score” or short note: “Your spend is volatile → higher plan uncertainty” |

### Optional (V1.5)

- Monte Carlo: P10 / P50 / P90 FIRE age.

---

## 4. Interaction flow

- **Initial:** Form with defaults (from Summary/Settings where applicable); results area **empty** or “Click Calculate to see your plan”.
- **Click “Calculate FIRE Plan”:** Loading 0.5–1 s (shimmer); then show Result Hero + metrics + charts/insights.
- **User edits any input:** Show “Unsaved changes”; button → “Recalculate”; **keep previous results** until Recalculate.
- **Click “Recalculate”:** Same as first run (loading → new results).

---

## 5. Charts (simple but clear)

1. **Asset growth (line):** Time vs portfolio value; “Current plan” and “Required plan” lines; mark FIRE number and target date.
2. **FIRE progress bar:** `current_assets / fire_number` (e.g. 0–100%).
3. **Sensitivity:** Small cards or list: “Spend −10% → FIRE −X years”, “Save +$500/mo → −Y years”, “SWR 3.5% → required +$Z”.

---

## 6. Navigation & routing

- Add **FIRE Calculator** to main nav (same level as Summary).
- **Route:** `/fire`.
- Same design system as rest of app: cards, spacing, typography, blue–purple accents.

---

## 7. Data dependencies

- **Summary API** (`GET /api/summary`): `lifetime.avgMonthlySpend`, `savingsStability.savingsRateStdDev`, `monthsAnalyzed` (for “Using app data” and volatility note). If &lt; 2 months, can still show calculator with manual inputs only.
- **Settings API** (`GET /api/settings`): `defaults.income` (monthly) → annual = × 12 for “Current annual income” default.
- **No new backend required for V1:** All FIRE math can be client-side; optional later: `POST /api/fire` to return metrics from server.

---

## 8. Copy & labels

- **Empty state:** “Enter your details and click Calculate FIRE Plan to see your target and path.”
- **Using app data:** Small tag next to prefilled fields: “Using app data”.
- **Result footnote:** “Based on your inputs and assumptions (SWR, return, inflation). Not financial advice.”
- **Risk:** “Emergency fund &lt; 6 months of spend. Consider building a larger buffer.”
- **Volatility:** “Your spending varies month to month; FIRE projections have higher uncertainty.”

This PRD is ready for Cursor (implementation) or Figma Make (visual design).
