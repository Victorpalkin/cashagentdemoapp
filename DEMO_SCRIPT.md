# Cash Agent Demo Script

**Duration**: 15-20 minutes | **Audience**: Google Cloud CE / Customers

---

## The Story

It's Tuesday morning. Sarah Chen, VP of Treasury at a multinational corporation, opens the Cash Agent Dashboard to start her day. The AI treasury agent has been working overnight -- scanning for anomalies, generating recommendations, and monitoring cash positions across seven currencies and fourteen bank accounts spanning four continents. Sarah's job is to review what the agent found, decide what to act on, and stress-test the plan.

---

## Pre-Demo Setup

1. Open the Management UI. Click the **gear icon** (sidebar top) and choose **Quick Reset** (or **Full Reset** to regenerate seed data with today's dates).
2. On the Dashboard, click **Execute Agents Synchronously Now** -- this populates recommendations, anomaly alerts, and agent activity.
3. Open the **Agent Chat** in a second browser tab (side-by-side with the UI). Use `adk web` locally or the deployed chat app.

---

## Beat 1 -- Morning Review

*Sarah opens the Dashboard to see where things stand.*

**What she sees in the UI** (Dashboard tab -- "Treasury Overview"):

- Seven **Cash Position Cards** in a compact 4-column grid: ~$5.2M Chase, ~$3.8M BofA, ~EUR 4.5M Deutsche Bank, ~GBP 1.9M Barclays, ~JPY 450M MUFG, ~SGD 2.7M DBS, ~AUD 2.4M ANZ, plus six more accounts -- totaling roughly **$34M** in the **Currency Summary** card below.
- The **FX Rates** card shows a 2-column layout with current rates: EUR/USD (~1.08), GBP/USD (~1.27), JPY/USD (~0.0067), CHF/USD (~1.12), SGD/USD (~0.75), AUD/USD (~0.66).
- The **Receivables vs Payables** card breaks down net AR/AP by currency with color-coded chips -- 75 AR items and 84 AP items across all seven currencies.
- The **Forecast Chart** shows two lines per currency: a solid **Agent-Enriched Forecast** (adjusted for probability-weighted AR, scheduled AP, and payment runs) and a dashed **ML Baseline** (pure TimesFM statistical forecast). Use the **Show All Currencies** toggle to switch between the top 3 (USD/EUR/GBP) and all 7 currencies. The lines diverge around AR/AP due dates, showing the agent's value-add.
- The **Scheduled Payment Runs** card lists 10 upcoming payment runs across all currencies -- she spots a $2.8M vendor run, a JPY 120M supplier batch, and a SGD 800K regional payroll.
- The **Recent Agent Activity** log shows the agent has already been at work: overnight forecast updates, anomaly scans, and position checks.

She notices the agent ran its last review a few hours ago. She clicks **Execute Agents Synchronously Now** to get a fresh analysis with the latest data.

**What she asks the agent** (optional confirmation):

> What's our current cash position across all bank accounts?

The agent confirms the same numbers: 14 accounts, 7 currencies, ~$34M total. The real-time BigQuery queries match the Dashboard exactly.

**Key talking points**: The Dashboard is powered by the same BigQuery data the agent queries. The agent runs autonomously on a Cloud Scheduler cadence (every 2-4 hours), so the Dashboard always reflects recent analysis -- not stale reports. The multinational scope (USD, EUR, GBP, JPY, CHF, SGD, AUD) demonstrates real-world treasury complexity.

---

## Beat 2 -- Risk Discovery

*Something catches Sarah's eye in the Recent Recommendations card.*

**What she sees in the UI** (Dashboard tab):

- The **Recent Recommendations** card at the bottom shows up to 5 recommendations. A **HIGH**-priority alert with a red chip catches her eye -- something about ACME Corp. She also notices a smaller action was already **auto-executed** by the agent overnight (amount < $100K, per the Approval Matrix).
- She scrolls down to the **Obligations Table** and spots the ACME Corp row -- EUR 2,300,000 receivable flagged with a warning icon indicating abnormally low collection probability.

She clicks the **Recommendations** tab to get the full picture.

**What she sees** (Recommendations tab -- "Agent Recommendations"):

5-7 recommendations grouped by priority, each with full **Agent Rationale** (always visible, never truncated) and numbered **Actions Upon Approval** steps. Typical recommendations include:

1. **HIGH -- Accelerate Collection**: ACME Corp EUR 2.3M at only 45% probability (vs typical 85-97%). The rationale explains the enriched forecast reduces expected EUR inflow by ~EUR 1.27M compared to what the ML model alone predicts. *Triggered by: Low Probability Receivable.*
2. **HIGH -- Accelerate Collection**: Takeda Pharmaceutical JPY 180M at 40% probability -- a payment dispute flagged by the agent. *Triggered by: Low Probability Receivable.*
3. **MEDIUM -- Place Term Deposit**: EUR surplus at ~153% of 30-day obligations, exceeding the 120% threshold. Amount > $500K, so it requires VP Treasury approval per Approval Matrix Section 2.1.
4. **MEDIUM -- FX Forward Hedge**: Net GBP exposure of ~GBP 1.4M exceeds the GBP 500K mandatory hedging threshold per FX Hedging Policy.
5. **MEDIUM -- Interbank Sweep**: Excess JPY balance at Mizuho can be consolidated to MUFG for better overnight rates.
6. **LOW -- Early Payment Discount**: Several AP items offer 2/10 net 30 terms -- capturing a 2% discount worth $15-50K.
7. **LOW -- Spot FX Rebalance**: AUD balance slightly above target; rebalance to USD.

Some small recommendations (< $100K) show as **auto-executed** -- the agent acted within its authority per the Approval Matrix.

She can also click the **Anomalies** tab:

**What she sees** (Anomalies tab -- "Anomaly Detection"):

Multiple anomaly types detected:
- **Low Probability Receivable**: ACME Corp (EUR), Takeda Pharmaceutical (JPY), BHP Mining (AUD)
- **TimesFM Cash Flow Anomaly**: Statistical anomalies detected by AI.DETECT_ANOMALIES
- **AP Concentration**: High vendor payment concentration risk
- **FX Exposure Breach**: Currency exposure exceeding policy thresholds
- **Payment Spike**: Unusual EUR outflow spike from emergency equipment replacement

Each anomaly card includes an **AI Analysis** box (blue, powered by Gemini) with:
- A business-context **explanation** of why the anomaly matters
- A specific **suggested action**
- A **View Recommendation** chip linking to the recommendation this anomaly triggered -- clicking it navigates to the Recommendations page

Back on the **Recommendations** tab, each recommendation that was triggered by an anomaly shows a **"Triggered by:"** chip (e.g., "Triggered by: Low Probability Receivable") linking back to the Anomalies page.

**What she asks the agent**:

> Check for any anomalies in our receivables and payables

The agent explains the ACME risk in plain language: a major Phase 3 enterprise delivery with collection confidence far below normal. It also flags Takeda Pharmaceutical in JPY and BHP Mining in AUD -- risks spanning three currencies.

**Key talking points**: The TimesFM foundation model forecasts cash flow from historical patterns via AI.FORECAST (no model training needed), but it can't see AR probability data or AP schedules. The agent enriches the forecast with this context -- **the Forecast Chart on the Dashboard visualizes this directly**: the solid Agent-Enriched line diverges from the dashed ML Baseline around AR/AP due dates, making the gap between "what the model thinks" and "what the agent knows" immediately visible. Every recommendation cites the delta between these two views. Policy references (Treasury Policy Section 2.3, FX Hedging Policy Section 2.1) come from semantic search over actual policy documents loaded at inference time, not hallucinated rules. Anomalies are no longer just statistical alerts -- Gemini explains each one in business terms with a suggested action, and traceability links show exactly which recommendations were spawned by which anomalies. The agent also auto-executes small actions (< $100K) overnight without human intervention, per the Approval Matrix.

---

## Beat 3 -- Taking Action

*Sarah decides to act on the EUR term deposit. But first, a quick transfer.*

**What she asks the agent**:

> Transfer $200,000 from Chase checking to Chase savings

The $200K amount falls in the $100K-$500K band, so the agent asks for confirmation. Sarah says "Yes" and the agent executes: it calls the Bank API for the transfer, posts the accounting entry to SAP, and logs everything to the audit trail. It reports back a confirmation number, updated balances, and an SAP document number.

**What she sees** (Executions tab -- "Execution History"):

- Summary cards at the top show counts by type: **Deposits**, **FX Trades**, **Transfers**, **Sweeps**, **Discounts**, and other action types.
- The execution table shows the completed transfer with columns for Time, Type ("Transfer"), Confirmation ID, Counterparty ("Chase"), Amount ($200,000), and Status ("Completed").
- If the agent auto-executed any small actions overnight, those appear here too with their confirmation details.

Now she turns to the bigger action.

> Execute the EUR term deposit for the surplus

The agent recognizes the amount exceeds $500K. Instead of executing, it creates a **formal approval request** and tells Sarah it's been submitted for VP Treasury approval.

**What she sees** (Recommendations tab -- "Agent Recommendations"):

- The **Pending Approvals** sub-tab (within Recommendations) shows the new approval request.
- The card displays the action type ("Place Term Deposit"), the amount, and a full **Agent Reasoning** section explaining why the deposit is warranted.
- Below that, numbered **execution steps** show exactly what will happen upon approval.

**Key talking points**: Three-tier authorization keeps the agent safe. Under $100K: auto-executed (visible in Executions tab). $100K-$500K: user confirms in chat. Over $500K: formal approval workflow with full reasoning. These thresholds are defined in the Approval Matrix policy document and loaded dynamically -- not hardcoded. Three external systems are integrated in a single agent action: Bank API, SAP ERP, and the audit log.

---

## Beat 4 -- Governance

*Sarah reviews and adjusts the deposit before approving.*

**What she sees** (Recommendations tab -- Pending Approvals):

She reads the agent's reasoning on the pending EUR deposit. The numbered execution plan makes it clear what will happen: transfer funds, place the deposit at ~4.2% annual rate, 30-day term, confirmation recorded.

She clicks **Edit** to adjust the amount -- the agent recommended the full surplus, but she wants to round it down to a clean number (e.g., EUR 500,000). The action type, amount, and currency fields become editable inline, and the execution plan updates live to reflect her changes. She clicks **Approve as Edited**.

The action auto-executes with the edited values. No need to go back to the agent chat -- approval triggers execution directly.

**What she sees** (Executions tab):

She switches to Executions. The deposit appears in the table with the **edited amount**, a contract ID, counterparty (Deutsche Bank), rate (4.2%), maturity date, and "Completed" status.

**What she sees** (Dashboard tab -- balance update):

She clicks back to the Dashboard. The EUR cash position card now shows a **lower balance** -- Deutsche Bank's checking balance decreased by the deposit amount (e.g., EUR 500,000). The grand total USD equivalent also reflects the change. This happens because successful executions automatically update `bank_accounts` balances and insert `cash_journal` entries, so the Dashboard always shows the real post-trade position.

**What she sees** (Audit Trail tab):

The complete chain is visible: recommendation created, approval requested, approved (with edits), executed. Every step is timestamped with the agent's reasoning preserved.

**Key talking points**: The complete lifecycle runs from analysis through execution: recommend, request approval, review and optionally edit, approve, auto-execute, record, **and update balances**. The agent respects the approval gate -- it won't execute without authorization, even during autonomous overnight runs. The **Edit** capability demonstrates human-in-the-loop override: the agent recommends, but the human can adjust the action type, amount, or currency before approving. Executed actions flow through to the Dashboard immediately -- approving a deposit reduces the source account balance, and approving an FX hedge adjusts both the sell-currency and USD accounts. Everything is auditable.

---

## Beat 4.5 -- Agent Memory

*Sarah rejects the ACME collection acceleration and teaches the agent why.*

**What she does** (Recommendations tab -- Pending Approvals):

She sees the ACME collection acceleration in the pending approvals. She clicks **Reject** and enters: "ACME has contractual 60-day payment terms. Low probability reflects timing, not credit risk."

After rejecting, a dialog asks: **"Should the agent remember this?"** The rejection reason is pre-filled. She clicks **Yes, Remember**.

**What she sees** (Memory tab):

She clicks the **Memory** tab to see all agent memories:

1. **Preference**: "Prefer Deutsche Bank over BNP Paribas for EUR term deposits" (seed memory)
2. **Policy Override**: "For GBP FX hedges, use 30-day settlement" (seed memory)
3. **Counterparty/Rejection**: "ACME has contractual 60-day payment terms..." (just created)

**What happens next**:

She clicks **Execute Agents Synchronously Now** on the Dashboard. The new recommendations no longer include the ACME collection acceleration. The rationale for other recommendations cites the agent's memory -- for example, the EUR deposit rationale mentions preferring Deutsche Bank per stored memory.

**Key talking points**: The agent learns from human decisions. Every rejection or edit can become persistent memory that shapes future recommendations. This is organizational knowledge capture -- the agent adapts to the company's specific context, not just generic policies. Memory entries can also be added manually or deactivated when no longer relevant.

---

## Beat 5 -- Policies & Governance Framework

*Sarah wants to show her team the policies driving the agent's decisions.*

**What she sees** (Policies tab -- "Treasury Policies"):

She clicks **Policies** in the System navigation section. The page shows:

- **Three threshold summary cards** at the top:
  - **Approval Matrix**: Three-tier authorization (Auto-execute < $100K, Confirmation $100K-$500K, Formal Approval > $500K)
  - **FX Hedging Thresholds**: Per-currency mandatory hedging limits (EUR 750K, GBP 500K, JPY 50M, CHF 500K, SGD 500K, AUD 500K)
  - **Treasury Policy**: Key parameters (Surplus ratio 120%, Collection risk threshold 60%, Strategic reserve $2M, Operating reserve 14 days)

- **Full policy documents** in expandable accordion sections below, rendered from the actual markdown policy files that the agent uses at inference time. What Sarah reads is exactly what grounds the agent's decisions -- not a summary or approximation.

**Key talking points**: The agent's decisions are grounded in actual policy documents, not hardcoded rules. The thresholds shown on this page are the same values used by the agent when generating recommendations, detecting anomalies, and determining approval requirements. Changing a threshold in the policy document changes agent behavior -- single source of truth. This transparency is critical for regulated industries where auditors need to verify what rules the AI is following.

---

## Beat 6 -- Stress Testing

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

1. **Beat 1**: Agent reports cash position across 14 accounts -- Dashboard shows the same totals
2. **Beat 2**: Agent explains ACME anomaly -- Obligations Table flags the row; auto-executed actions visible in Executions
3. **Beat 3**: Agent creates approval request -- Recommendations tab shows it with full reasoning
4. **Beat 4**: Click Approve in the UI -- Executions tab shows the trade confirmation
5. **Beat 4.5**: Reject ACME in Recommendations -- Memory tab shows the new entry
6. **Beat 5**: Navigate to Policies -- show the governance framework grounding agent decisions
7. **Beat 6**: Agent runs scenario -- Dashboard serves as the base-case reference

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
9. [Reject ACME approval -> "Remember this?" -> Yes -> check Memory tab]
10. [Execute Agents Synchronously Now -> recommendations now reflect memory]
11. [Navigate to Policies tab -> review governance framework]
12. What if ACME Corp doesn't pay and EUR/USD drops 5%?
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
| Vertex AI Agent Engine | Managed agent runtime, session management |
| Gemini (2.5 Flash / Pro) | LLM inference for agents, chat, recommendations |
| BigQuery | Data warehouse, operational tables |
| TimesFM (AI.FORECAST) | Zero-training time-series forecasting and anomaly detection |
| Cloud Run | Mock services, UI, UI API, Chat App, Agent Runner |
| Cloud Scheduler | Autonomous agent execution + daily data refresh |
| Artifact Registry | Docker image management |

### Key Data Points

| Data Point | Value |
|-----------|-------|
| Total cash position | ~$34M USD equivalent |
| Currencies | 7 (USD, EUR, GBP, JPY, CHF, SGD, AUD) |
| Bank accounts | 14 across 8 banks |
| Banks | Chase, BofA, Deutsche Bank, BNP Paribas, Barclays, MUFG, Mizuho, UBS, DBS, OCBC, ANZ, Westpac |
| USD holdings | $11.1M (3 accounts) |
| EUR holdings | EUR 6.8M (2 accounts) |
| GBP holdings | GBP 3.1M (2 accounts) |
| JPY holdings | JPY 650M (2 accounts) |
| CHF holdings | CHF 1.8M (1 account) |
| SGD holdings | SGD 3.9M (2 accounts) |
| AUD holdings | AUD 3.5M (2 accounts) |
| AR items | 75 across 7 currencies |
| AP items | 84 across 7 currencies |
| Payment runs | 10 scheduled batches |
| Recommendations per run | 5-7 (anomaly-driven + policy-driven) |
| ACME Corp receivable | EUR 2,300,000 at 45% probability |
| Takeda Pharmaceutical | JPY 180,000,000 at 40% probability |
| BHP Mining Services | AUD 450,000 at 35% probability |
| Surplus threshold | 120% of 30-day obligations (from Treasury Policy) |
| Auto-execute limit | < $100K (from Approval Matrix) |
| Confirm limit | $100K-$500K (from Approval Matrix) |
| Formal approval limit | > $500K (from Approval Matrix) |
| FX hedge thresholds | EUR 750K, GBP 500K, JPY 50M, CHF 500K, SGD 500K, AUD 500K |
| Action types | PLACE_DEPOSIT, HEDGE_FX, ACCELERATE_COLLECTION, PLACE_INVESTMENT, INTERBANK_SWEEP, SPOT_FX_REBALANCE, EARLY_PAYMENT_DISCOUNT |
| Anomaly types | TIMESFM_CASH_FLOW_ANOMALY, LOW_PROBABILITY_RECEIVABLE, AP_CONCENTRATION, FX_EXPOSURE_BREACH, PAYMENT_SPIKE |

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent returns errors about missing tables | Use Full Reset from gear icon or run `bash reset_demo.sh --full` |
| "No FX rates found" | FX rates use date-based lookup; Full Reset regenerates with today's dates |
| Approval workflow not triggering | Ensure amount exceeds $500K; run Full Reset if tables are missing |
| BQML forecast unavailable | Model may need retraining; see `deploy.sh` |
| Slow responses on `adk web` | First query initializes connections; subsequent queries are faster |
| Mock service errors | Check Cloud Run services: `gcloud run services list` |
| Recommendations empty after reset | Click **Execute Agents Synchronously Now** on the Dashboard |
| Policy thresholds not loading | Check `/api/policy-thresholds` endpoint; ensure `pyyaml` is installed in ui_api |
| Only 3 currencies in forecast chart | Click **Show All Currencies** toggle to see all 7 |
