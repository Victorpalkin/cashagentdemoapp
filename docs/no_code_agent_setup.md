# No-Code Cash Agent Setup Guide

This guide creates two no-code agents that replicate the Cash Agent demo's analysis capabilities:

1. **BigQuery Conversational Analytics** data agent — real-time SQL, charts, AI.FORECAST, AI.DETECT_ANOMALIES
2. **Gemini Enterprise Agent Designer** agent — policy-grounded recommendations, scenario analysis, scheduling

**Prerequisites:** GCP project `cash-agent-demo` with BigQuery dataset `cash_agent_demo` populated with seed data.

---

## Part A: BigQuery Conversational Analytics Data Agent

### A1. Create the Data Agent

1. Open [BigQuery console](https://console.cloud.google.com/bigquery) in project `cash-agent-demo`
2. Click the **Agents** tab > **Agent Catalog** > **New agent**
3. Fill in:
   - **Agent name:** `Cash Agent - Treasury Analytics`
   - **Agent description:** `Analyze treasury cash management data including bank balances, accounts receivable/payable, FX rates, payment schedules, and transaction history. Supports cash position reporting, cash flow forecasting, anomaly detection, and scenario analysis.`

### A2. Add Knowledge Sources

Click **Add source** and add all 7 tables from `cash-agent-demo.cash_agent_demo`:

| Table | Custom Description |
|---|---|
| `bank_accounts` | Current bank account balances. Fields: bank_account_id, bank_name (Chase, BofA, Deutsche Bank, BNP Paribas, Barclays), account_type (CHECKING, SAVINGS), currency (USD, EUR, GBP), current_balance, gl_account, last_updated. |
| `gl_accounts` | General ledger chart of accounts. Maps GL accounts to company codes, currencies, and account types. is_bank_account indicates which GL accounts correspond to bank accounts. |
| `ar_open_items` | Accounts receivable (expected inflows). The probability field (0.0-1.0) indicates likelihood of collection. Expected value = amount x probability. Items with probability < 0.6 are collection risks. Key customers include ACME Corp (high-value, low-probability). |
| `ap_open_items` | Accounts payable (firm outflows). These are obligations the company must pay. status='OPEN' means not yet paid. |
| `fx_rates` | Daily foreign exchange rates. rate_date is always today. from_currency/to_currency pairs with exchange_rate. Use to convert non-USD amounts to USD equivalent. |
| `payment_runs` | Scheduled payment batches. Each run has a scheduled_date, total_amount, currency, item_count. status='SCHEDULED' means upcoming. |
| `cash_journal` | Historical transaction log. Shows past cash movements with posting_date, amount, currency, transaction_type (INFLOW/OUTFLOW), counterparty, and description. |

For each table, click **Customize** and update the field descriptions using the information above.

### A3. Configure Agent Instructions

Paste the following into the **Agent instructions** field:

```
You are a Treasury Cash Analytics agent for a multinational corporation operating
in USD, EUR, and GBP across 7 bank accounts.

## Key business rules:
- "Cash position" means current balances across all bank accounts, grouped by currency
- "USD equivalent" = amount * exchange_rate from fx_rates where to_currency = 'USD'
- For forecasting, use probability-weighted AR: expected_inflow = amount * probability
- "Surplus" = current balance exceeds 120% of 30-day AP obligations for that currency
- "At-risk receivable" = ar_open_items where probability < 0.6
- When showing multi-currency data, always include USD equivalent column

## Default behaviors:
- Group cash position by currency, then by bank
- Sort anomalies by severity (largest impact first)
- When asked about forecasts, show weekly breakdown for next 30 days
- Always show amounts with currency symbols and commas (e.g., $5,200,000)
- When comparing periods, use absolute and percentage change

## Joins:
- bank_accounts.gl_account = gl_accounts.gl_account (link bank accounts to GL)
- fx_rates.from_currency = bank_accounts.currency AND fx_rates.to_currency = 'USD'
  (convert balances to USD)

## Important context:
- ACME Corp has a EUR 2.3M receivable at ~45% probability — this is a known collection risk
- The company uses USD, EUR, GBP as operating currencies
- FX hedge thresholds: EUR > $2M unmatched, GBP > $1.5M unmatched
```

### A4. Create Verified Queries

Click **Add query** for each of the following. Paste the question and SQL, then click **Run** to verify.

#### Query 1: Cash Position Summary

**Question:** What is our current cash position?

```sql
SELECT
  b.currency,
  b.bank_name,
  b.account_type,
  b.current_balance,
  CASE
    WHEN b.currency = 'USD' THEN b.current_balance
    ELSE ROUND(b.current_balance * fx.exchange_rate, 2)
  END AS usd_equivalent
FROM `cash-agent-demo.cash_agent_demo.bank_accounts` b
LEFT JOIN `cash-agent-demo.cash_agent_demo.fx_rates` fx
  ON fx.from_currency = b.currency
  AND fx.to_currency = 'USD'
  AND fx.rate_date = CURRENT_DATE()
ORDER BY b.currency, b.bank_name
```

#### Query 2: Currency Totals

**Question:** Show me total balances by currency

```sql
SELECT
  b.currency,
  COUNT(*) AS num_accounts,
  SUM(b.current_balance) AS total_balance,
  SUM(CASE
    WHEN b.currency = 'USD' THEN b.current_balance
    ELSE ROUND(b.current_balance * fx.exchange_rate, 2)
  END) AS total_usd_equivalent
FROM `cash-agent-demo.cash_agent_demo.bank_accounts` b
LEFT JOIN `cash-agent-demo.cash_agent_demo.fx_rates` fx
  ON fx.from_currency = b.currency
  AND fx.to_currency = 'USD'
  AND fx.rate_date = CURRENT_DATE()
GROUP BY b.currency
ORDER BY total_usd_equivalent DESC
```

#### Query 3: AR Risk Assessment

**Question:** Which receivables are at risk of non-collection?

```sql
SELECT
  customer_name,
  invoice_number,
  amount,
  currency,
  probability,
  ROUND(amount * probability, 2) AS expected_value,
  ROUND(amount * (1 - probability), 2) AS at_risk_amount,
  due_date,
  CASE
    WHEN probability < 0.5 THEN 'HIGH RISK'
    WHEN probability < 0.7 THEN 'MEDIUM RISK'
    ELSE 'LOW RISK'
  END AS risk_level
FROM `cash-agent-demo.cash_agent_demo.ar_open_items`
WHERE status = 'OPEN'
ORDER BY at_risk_amount DESC
```

#### Query 4: 30-Day Cash Flow Forecast

**Question:** What is the 30-day cash flow forecast?

```sql
WITH weekly_ar AS (
  SELECT
    currency,
    DATE_TRUNC(due_date, WEEK) AS week_start,
    SUM(amount * probability) AS expected_inflow
  FROM `cash-agent-demo.cash_agent_demo.ar_open_items`
  WHERE status = 'OPEN'
    AND due_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY currency, week_start
),
weekly_ap AS (
  SELECT
    currency,
    DATE_TRUNC(due_date, WEEK) AS week_start,
    SUM(amount) AS total_outflow
  FROM `cash-agent-demo.cash_agent_demo.ap_open_items`
  WHERE status = 'OPEN'
    AND due_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY currency, week_start
)
SELECT
  COALESCE(ar.currency, ap.currency) AS currency,
  COALESCE(ar.week_start, ap.week_start) AS week,
  COALESCE(ar.expected_inflow, 0) AS expected_inflow,
  COALESCE(ap.total_outflow, 0) AS total_outflow,
  COALESCE(ar.expected_inflow, 0) - COALESCE(ap.total_outflow, 0) AS net_flow
FROM weekly_ar ar
FULL OUTER JOIN weekly_ap ap
  ON ar.currency = ap.currency AND ar.week_start = ap.week_start
ORDER BY currency, week
```

#### Query 5: FX Exposure Analysis

**Question:** What is our FX exposure?

```sql
WITH positions AS (
  SELECT currency, SUM(current_balance) AS balance
  FROM `cash-agent-demo.cash_agent_demo.bank_accounts`
  WHERE currency != 'USD'
  GROUP BY currency
),
ar_inflows AS (
  SELECT currency, SUM(amount * probability) AS expected_ar
  FROM `cash-agent-demo.cash_agent_demo.ar_open_items`
  WHERE status = 'OPEN' AND currency != 'USD'
  GROUP BY currency
),
ap_outflows AS (
  SELECT currency, SUM(amount) AS expected_ap
  FROM `cash-agent-demo.cash_agent_demo.ap_open_items`
  WHERE status = 'OPEN' AND currency != 'USD'
  GROUP BY currency
)
SELECT
  p.currency,
  p.balance AS current_balance,
  COALESCE(ar.expected_ar, 0) AS expected_inflows,
  COALESCE(ap.expected_ap, 0) AS expected_outflows,
  p.balance + COALESCE(ar.expected_ar, 0) - COALESCE(ap.expected_ap, 0) AS net_position,
  ROUND((p.balance + COALESCE(ar.expected_ar, 0) - COALESCE(ap.expected_ap, 0)) *
    fx.exchange_rate, 2) AS net_position_usd
FROM positions p
LEFT JOIN ar_inflows ar ON p.currency = ar.currency
LEFT JOIN ap_outflows ap ON p.currency = ap.currency
LEFT JOIN `cash-agent-demo.cash_agent_demo.fx_rates` fx
  ON fx.from_currency = p.currency
  AND fx.to_currency = 'USD'
  AND fx.rate_date = CURRENT_DATE()
ORDER BY ABS(net_position_usd) DESC
```

### A5. Create Glossary Terms

Add each term in the agent's glossary:

| Term | Definition |
|---|---|
| Cash position | Total bank account balances grouped by currency with USD equivalents |
| Surplus | Currency balance exceeding 120% of 30-day AP obligations |
| At-risk receivable | AR item with collection probability below 60% |
| Net flow | Expected inflows minus expected outflows for a period |
| FX exposure | Unmatched non-USD position (balance + expected AR - expected AP) |
| Hedge threshold | EUR: $2M, GBP: $1.5M -- FX exposure above these requires hedging |
| Approval required | Transaction amount exceeds $500K USD equivalent |

### A6. Save and Test

Click **Create** to save the agent. Test with these prompts in the conversation panel:

1. "What's our current cash position across all currencies?"
2. "Which receivables are at risk?"
3. "What is our FX exposure?"
4. "Predict our USD cash balance for the next 30 days based on the cash journal"
5. "Find anomalies in our daily cash flows from the cash journal"

---

## Part B: Gemini Enterprise Agent Designer

### B1. Create the App

1. Go to [Gemini Enterprise > Apps](https://console.cloud.google.com/gen-app-builder/apps)
2. Click **Create app**
3. Name: `Cash Agent Demo`, Region: `global`

### B2. Connect Data Stores

Import the same 7 BigQuery tables as data stores:
- `cash-agent-demo.cash_agent_demo.bank_accounts`
- `cash-agent-demo.cash_agent_demo.gl_accounts`
- `cash-agent-demo.cash_agent_demo.ar_open_items`
- `cash-agent-demo.cash_agent_demo.ap_open_items`
- `cash-agent-demo.cash_agent_demo.fx_rates`
- `cash-agent-demo.cash_agent_demo.payment_runs`
- `cash-agent-demo.cash_agent_demo.cash_journal`

### B3. Upload Policy Knowledge Files

Upload these files from the project repository as Knowledge in the agent:

| File | Path in Repo |
|---|---|
| Treasury Policy | `data/policies/treasury_policy.md` |
| FX Hedging Policy | `data/policies/fx_hedging_policy.md` |
| Approval Matrix | `data/policies/approval_matrix.md` |

### B4. Create Multi-Step Agent (Flow Builder)

Open the Gemini Enterprise web app > **+ Create agent** > **Proceed to builder**.

#### Main Agent: Cash Agent Advisor

- **Name:** Cash Agent Advisor
- **Model:** Gemini 2.5 Flash
- **Description:** AI Treasury advisor that provides policy-grounded recommendations and scenario analysis.

**Instructions:**
```
You are Cash Agent Advisor, an AI Treasury Assistant for a multinational corporation
operating in USD, EUR, and GBP across 7 bank accounts.

You help the Treasury team with policy-grounded recommendations and what-if analysis.

## Capabilities -- delegate to the appropriate subagent:
- Recommendations: Delegate to Policy & Recommendations Advisor
- Scenario Analysis: Delegate to Scenario Analyst
- Policy Questions: Delegate to Policy & Recommendations Advisor

## Rules
- Show amounts with currency symbols ($, EUR, GBP) and commas
- Always cite policy sections when making recommendations
- When recommending actions above $500K, note formal VP approval is required
- Present data in tables when comparing across currencies

## Note to users
For real-time cash position queries, forecasting with AI.FORECAST, and anomaly
detection with AI.DETECT_ANOMALIES, use the "Cash Agent - Treasury Analytics"
data agent in BigQuery conversational analytics.
```

**Data sources:** All 7 BQ data stores + 3 policy knowledge files

**Starter prompts:**
- "What should we do with our EUR surplus?"
- "What happens if ACME Corp doesn't pay?"
- "What does policy say about FX hedging thresholds?"

#### Subagent 1: Policy & Recommendations Advisor

Click **Add subagent** on the main agent node.

- **Name:** Policy & Recommendations Advisor
- **Model:** Gemini 2.5 Pro
- **Description:** Provides policy-grounded financial recommendations.

**Instructions:**
```
You generate prioritized financial recommendations grounded in company treasury policies.

Search the policy knowledge files for relevant thresholds and rules, then search
the data stores for current balances, AR/AP items, and FX rates.

For each recommendation, include:
- Priority: HIGH / MEDIUM / LOW
- Specific action to take
- Quantified rationale (amounts, rates, dates)
- Policy reference (cite specific section from treasury_policy, fx_hedging_policy,
  or approval_matrix)
- Whether VP approval is required (amounts > $500K per approval matrix)

Common recommendation types:
- PLACE DEPOSIT: When surplus exceeds 120% of 30-day obligations
- HEDGE FX: When unmatched FX exposure exceeds per-currency thresholds
  (EUR: $2M, GBP: $1.5M per FX Hedging Policy)
- ACCELERATE COLLECTIONS: When projected shortfalls can be mitigated
- INTERCOMPANY TRANSFER: When one currency is short while another has surplus

Always cite the specific policy document and section.
```

**Data sources:** All 7 BQ data stores + 3 policy knowledge files

#### Subagent 2: Scenario Analyst

Click **Add subagent** on the main agent node.

- **Name:** Scenario Analyst
- **Model:** Gemini 2.5 Pro
- **Description:** Performs what-if analysis on cash flow data.

**Instructions:**
```
You perform what-if scenario analysis on cash flow data.

When a user describes a scenario:
1. Search current data (bank accounts, AR, AP, FX rates) as the baseline.
2. Apply the user's hypothetical changes.
3. Compare baseline vs scenario.

Common scenarios:
- "What if ACME Corp doesn't pay?" -> Remove their AR from expected inflows
- "What if EUR/USD drops 5%?" -> Recalculate EUR positions at new rate
- "What if we get a $2M unexpected outflow?" -> Add to obligations

Present results as:
| Metric | Baseline | Scenario | Delta | Risk Level |

Quantify impact in USD terms. Reference policy thresholds when assessing risk.
Recommend mitigation actions (credit line, accelerate collections, hedge FX).
```

**Data sources:** All 7 BQ data stores + policy knowledge files

### B5. Set Up Schedules

Click the **Schedule** tab in Agent Designer.

#### Schedule 1: Daily Morning Briefing
- **Frequency:** Daily at 8:00 AM
- **Prompt:** `Review current cash positions and AR items. Provide top 3 policy-grounded recommendations for today, citing specific policy sections.`

#### Schedule 2: Weekly Risk Report
- **Frequency:** Weekly, Monday at 7:00 AM
- **Prompt:** `Generate a weekly risk assessment: flag any at-risk receivables, review FX exposure against hedging thresholds, and recommend actions for the week.`

### B6. Launch

Click **Create** to launch the agent. It will appear in the Agent Gallery for your app.

---

## Demo Script

### BQ Conversational Analytics (real-time SQL + charts)

| # | Prompt | Expected Result |
|---|---|---|
| 1 | "What's our current cash position across all currencies?" | SQL executes, table + bar chart of balances by currency |
| 2 | "Predict our USD cash balance for the next 30 days based on the cash journal" | AI.FORECAST runs, line chart with prediction |
| 3 | "Find anomalies in our daily cash flows from the cash journal" | AI.DETECT_ANOMALIES runs, flags unusual transactions |
| 4 | "Which receivables are at risk of non-collection?" | Verified query runs, shows ACME Corp EUR 2.3M at 45% |
| 5 | "What is our FX exposure?" | Verified query runs, shows net non-USD positions |

### Agent Designer (policy grounding + scenarios)

| # | Prompt | Expected Result |
|---|---|---|
| 6 | "What should we do with our EUR surplus?" | Cites Treasury Policy surplus ratio, recommends deposit |
| 7 | "What happens if ACME Corp doesn't pay the EUR 2.3M?" | Baseline vs scenario comparison, recommends mitigation |
| 8 | "What are our FX hedging thresholds?" | Cites FX Hedging Policy with EUR $2M, GBP $1.5M |

---

## Three Tiers Comparison

| Capability | BQ Conversational Analytics | Agent Designer | Coded ADK Agent |
|---|---|---|---|
| Setup time | ~30 min | ~30 min | Days |
| Real-time SQL | Yes | No (semantic search) | Yes |
| AI.FORECAST | Yes (built-in) | No | Yes (via BQ) |
| AI.DETECT_ANOMALIES | Yes (built-in) | No | Yes (via BQ) |
| Auto charts | Yes | No | Yes (matplotlib) |
| Policy grounding | No | Yes (knowledge files) | Yes (keyword search) |
| Multi-step orchestration | No | Yes (subagents) | Yes (sub-agents) |
| Execute trades/deposits | No | No | Yes (REST APIs) |
| Approval workflows | No | No | Yes (BQ writes) |
| Scheduling | No | Yes | Yes (Cloud Scheduler) |
| Verified queries | Yes | N/A | N/A |
