# Cash Agent Demo Script

**Duration**: 15-20 minutes | **Audience**: Google Cloud CE / Customers

---

## The Story

It's Tuesday morning. Sarah Chen, VP of Treasury at a multinational corporation, opens the Cash Agent Dashboard to start her day. The AI treasury agent has been working overnight -- scanning for anomalies, generating recommendations, and monitoring cash positions across three currencies. Sarah's job is to review what the agent found, decide what to act on, and stress-test the plan.

---

## Pre-Demo Setup

1. Open the Management UI. Click the **gear icon** (top-right) and choose **Quick Reset** (or **Full Reset** to regenerate seed data with today's dates).
2. On the Dashboard, click **Run Agent Review** -- this populates recommendations, anomaly alerts, and agent activity.
3. Open the **Agent Chat** in a second browser tab (side-by-side with the UI). Use `adk web` locally or the deployed chat app.

---

## Beat 1 -- Morning Review

*Sarah opens the Dashboard to see where things stand.*

**What she sees in the UI** (Dashboard tab -- "Treasury Overview"):

- Three **Cash Position Cards** across the top: ~$11.1M USD, ~EUR 6.8M, ~GBP 3.1M -- totaling roughly **$22.4M** in the **Currency Summary** card below.
- The **FX Rates** card shows current EUR/USD (~1.08) and GBP/USD (~1.27) rates.
- The **Receivables vs Payables** card breaks down net AR/AP by currency with color-coded chips.
- The **Forecast Chart** shows the BQML ARIMA+ projection with confidence intervals.
- The **Scheduled Payment Runs** card lists upcoming outflows -- she spots a $2.8M vendor run and a $1.5M payroll run in the next two weeks.
- The **Recent Agent Activity** log shows the agent has already been at work: overnight forecast updates, anomaly scans, and position checks.

She notices the agent ran its last review a few hours ago. She clicks **Run Agent Review** to get a fresh analysis with the latest data.

**What she asks the agent** (optional confirmation):

> What's our current cash position across all bank accounts?

The agent confirms the same numbers: 7 accounts, 3 currencies, ~$22.4M total. The real-time BigQuery queries match the Dashboard exactly.

**Key talking points**: The Dashboard is powered by the same BigQuery data the agent queries. The agent runs autonomously on a Cloud Scheduler cadence (every 2-4 hours), so the Dashboard always reflects recent analysis -- not stale reports.

---

## Beat 2 -- Risk Discovery

*Something catches Sarah's eye in the Recent Recommendations card.*

**What she sees in the UI** (Dashboard tab):

- The **Recent Recommendations** card at the bottom of the Dashboard shows a **HIGH**-priority alert with a red chip. Something about ACME Corp.
- She scrolls down to the **Obligations Table** and spots the ACME Corp row -- EUR 2,300,000 receivable flagged with an abnormally low probability indicator.

She clicks the **Recommendations** tab to get the full picture.

**What she sees** (Recommendations tab -- "Agent Recommendations"):

Three recommendations grouped by priority, each with full **Agent Rationale** (always visible, never truncated) and numbered **Actions Upon Approval** steps:

1. **HIGH -- Accelerate Collection**: ACME Corp EUR 2.3M at only 45% probability (vs typical 85-97%). The rationale explains the enriched forecast reduces expected EUR inflow by ~EUR 1.27M compared to what the ML model alone predicts.
2. **MEDIUM -- Place Term Deposit**: EUR surplus at ~153% of 30-day obligations, exceeding the 120% threshold. Amount > $500K, so it requires VP Treasury approval per Approval Matrix Section 2.1.
3. **MEDIUM -- FX Forward Hedge**: Net GBP exposure of ~GBP 1.4M exceeds the GBP 500K mandatory hedging threshold.

**What she asks the agent**:

> Check for any anomalies in our receivables and payables

The agent explains the ACME risk in plain language: a major Phase 3 enterprise delivery with collection confidence far below normal. It quantifies the impact -- EUR 2.3M at risk equals roughly $2.5M USD.

**Key talking points**: The BQML ARIMA+ model forecasts cash flow from historical patterns, but it can't see AR probability data or AP schedules. The agent enriches the forecast with this context -- every recommendation cites the delta between ML-only and agent-enriched views. Policy references (Treasury Policy Section 2.3, FX Hedging Policy Section 2.1) come from semantic search over actual policy documents, not hallucinated rules.

---

## Beat 3 -- Taking Action

*Sarah decides to act on the EUR term deposit. But first, a quick transfer.*

**What she asks the agent**:

> Transfer $200,000 from Chase checking to Chase savings

The $200K amount falls in the $100K-$500K band, so the agent asks for confirmation. Sarah says "Yes" and the agent executes: it calls the Bank API for the transfer, posts the accounting entry to SAP, and logs everything to the audit trail. It reports back a confirmation number, updated balances, and an SAP document number.

**What she sees** (Executions tab -- "Execution History"):

- Summary cards at the top show counts: **Deposits**, **FX Trades**, **Other Actions**.
- The execution table shows the completed transfer with columns for Time, Type ("Transfer"), Confirmation ID, Counterparty ("Chase"), Amount ($200,000), and Status ("Completed").

Now she turns to the bigger action.

> Execute the EUR term deposit for the surplus

The agent recognizes the amount exceeds $500K. Instead of executing, it creates a **formal approval request** and tells Sarah it's been submitted for VP Treasury approval.

**What she sees** (Approvals tab -- "Agent Approvals"):

- The **Pending** sub-tab shows the new approval request (the UI polls every 5 seconds).
- The card displays the action type ("Place Term Deposit"), the amount, and a full **Agent Reasoning** section explaining why the deposit is warranted.
- Below that, numbered **execution steps** show exactly what will happen upon approval.

**Key talking points**: Three-tier authorization keeps the agent safe. Under $100K: auto-executed. $100K-$500K: user confirms in chat. Over $500K: formal approval workflow with full reasoning. Three external systems are integrated in a single agent action: Bank API, SAP ERP, and the audit log.

---

## Beat 4 -- Governance

*Sarah reviews and adjusts the deposit before approving.*

**What she sees** (Approvals tab):

She reads the agent's reasoning on the pending EUR deposit. The numbered execution plan makes it clear what will happen: transfer funds, place the deposit at ~4.2% annual rate, 30-day term, confirmation recorded.

She clicks **Edit** to adjust the amount -- the agent recommended the full surplus, but she wants to round it down to a clean number (e.g., EUR 500,000). The action type, amount, and currency fields become editable inline, and the execution plan updates live to reflect her changes. She clicks **Approve as Edited**.

The action auto-executes with the edited values. No need to go back to the agent chat -- approval triggers execution directly.

**What she sees** (Executions tab):

She switches to Executions. The deposit appears in the table with the **edited amount**, a contract ID, counterparty (Deutsche Bank), rate (4.2%), maturity date, and "Completed" status.

**What she sees** (Audit Trail tab):

The complete chain is visible: recommendation created, approval requested, approved (with edits), executed. Every step is timestamped with the agent's reasoning preserved.

**Key talking points**: The complete lifecycle runs from analysis through execution: recommend, request approval, review and optionally edit, approve, auto-execute, record. The agent respects the approval gate -- it won't execute without authorization, even during autonomous overnight runs. The **Edit** capability demonstrates human-in-the-loop override: the agent recommends, but the human can adjust the action type, amount, or currency before approving. Everything is auditable.

---

## Beat 5 -- Stress Testing

*Sarah wants to understand the downside risk before her board call.*

**What she asks the agent**:

> What if ACME Corp doesn't pay and EUR/USD drops 5%?

The agent runs a compound scenario simulation: ACME non-payment removes ~EUR 1.035M of expected inflow (EUR 2.3M x 45% probability), and the EUR/USD drop from 1.08 to 1.026 reduces the USD value of all EUR holdings. Combined impact: approximately **$2.6M negative delta**.

The Dashboard remains open as the base-case reference -- Sarah can compare the scenario results against the live position.

**Key talking points**: Compound scenarios (customer credit risk + FX risk) are modeled together in a pure Python scenario engine -- no separate simulation service needed. The quantified impact helps Sarah walk into her board meeting with a clear risk picture.

---

## Dual-Screen Setup

For maximum impact, present with two browser windows side by side:

| Left Screen | Right Screen |
|-------------|-------------|
| Agent Chat (`adk web` or deployed chat app) | Management UI |

Key moments where both screens shine:

1. **Beat 1**: Agent reports cash position -- Dashboard shows the same totals
2. **Beat 2**: Agent explains ACME anomaly -- Obligations Table flags the row
3. **Beat 3**: Agent creates approval request -- Approvals tab shows it with full reasoning
4. **Beat 4**: Click Approve in the UI -- Executions tab shows the trade confirmation
5. **Beat 5**: Agent runs scenario -- Dashboard serves as the base-case reference

---

## Quick-Reference Prompt List

```
1. What's our current cash position across all bank accounts?
2. Show me the 30-day cash flow forecast
3. Check for any anomalies in our receivables and payables
4. What are your recommendations?
5. Execute the EUR term deposit for the surplus
6. Transfer $200,000 from Chase checking to Chase savings
7. Show me what you just did
8. Show me pending approval requests
   [approve in UI -> auto-executes -> check Executions tab]
9. What if ACME Corp doesn't pay and EUR/USD drops 5%?
```

---

## Appendix: Architecture

```
                        +------------------+
                        |   Root Agent     |
                        | (cash_agent)     |
                        +--------+---------+
                                 |
          +----------+-----------+-----------+----------+----------+
          |          |           |           |          |          |
   +------+--+ +----+----+ +---+----+ +----+---+ +----+---+ +---+----+
   |CashPos. | |Forecast | |Recomm. | |Execut. | |Anomaly | |Scenario|
   |Agent    | |Agent    | |Agent   | |Agent   | |Det.    | |Sim.    |
   +---------+ +---------+ +--------+ +--------+ +--------+ +--------+
       |           |           |           |          |          |
   +---+---+  +---+---+  +---+---+  +---+---+  +---+---+  +---+---+
   |BQ     |  |BQ     |  |BQ     |  |Bank   |  |BQ     |  |BQ     |
   |FX     |  |BQML   |  |Policy |  |Broker |  |       |  |FX     |
   |       |  |       |  |FX     |  |SAP    |  |       |  |       |
   +-------+  +-------+  +-------+  |Approv.|  +-------+  +-------+
                                     |Audit  |
                                     +-------+
```

### Google Cloud Components

| Component | Role |
|-----------|------|
| ADK (Agent Development Kit) | Agent framework, orchestration |
| Vertex AI | LLM inference (Gemini) |
| BigQuery | Data warehouse, operational tables |
| BQML ARIMA+ | Time-series cash flow forecasting |
| Cloud Run | Mock services, UI, UI API, Chat App, Agent Runner |
| Cloud Scheduler | Autonomous agent execution + daily data refresh |
| Artifact Registry | Docker image management |

### Key Data Points

| Data Point | Value |
|-----------|-------|
| Total cash position | ~$22.4M USD equivalent |
| USD holdings | $11.1M (3 accounts) |
| EUR holdings | EUR 6.8M (2 accounts) |
| GBP holdings | GBP 3.1M (2 accounts) |
| EUR/USD rate | ~1.08 |
| GBP/USD rate | ~1.27 |
| ACME Corp receivable | EUR 2,300,000 at 45% probability |
| Surplus threshold | 120% of 30-day obligations |
| Auto-execute limit | < $100K |
| Confirm limit | $100K-$500K |
| Formal approval limit | > $500K |

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent returns errors about missing tables | Use Full Reset from gear icon or run `bash reset_demo.sh --full` |
| "No FX rates found" | FX rates use date-based lookup; Full Reset regenerates with today's dates |
| Approval workflow not triggering | Ensure amount exceeds $500K; run Full Reset if tables are missing |
| BQML forecast unavailable | Model may need retraining; see `deploy.sh` |
| Slow responses on `adk web` | First query initializes connections; subsequent queries are faster |
| Mock service errors | Check Cloud Run services: `gcloud run services list` |
| Recommendations empty after reset | Click **Run Agent Review** on the Dashboard |
