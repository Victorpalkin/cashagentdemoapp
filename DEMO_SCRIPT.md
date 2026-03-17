# Cash Agent Demo Script

**Duration**: 15-20 minutes | **Audience**: Google Cloud CE / Customers

---

## Always-Fresh Demo

Data refreshes daily at 2 AM UTC via Cloud Scheduler. The autonomous agent runner generates recommendations, detects anomalies, and logs activity every few hours. This means:

- **Dates are always relative to today** — no stale data
- **BQML model is retrained nightly** on fresh historical data
- **Dashboard shows recent agent activity** from autonomous runs
- **Recommendations tab is pre-populated** with agent-generated suggestions
- **No need to run `reset_demo.sh` before demos** (though you can use the UI's gear icon for quick/full reset)

---

## Pre-Demo Setup

1. **Option A — Use the UI Reset** (recommended):
   Open the Management UI, click the gear icon (top-right), and choose "Quick Reset" to clear operational tables. Or "Full Reset" to also regenerate seed data with today's dates.

2. **Option B — Command line**:
   ```bash
   bash reset_demo.sh          # Quick: truncate operational tables
   bash reset_demo.sh --full   # Full: also reload seed data
   ```

3. **Start the agent** (choose one):
   ```bash
   # Local (preferred for demos — fastest response)
   cd agent && adk web

   # Or use the deployed chat app
   open https://chat-app-rgw57p2taa-uc.a.run.app
   ```

4. **Open the Management UI** in a second browser tab (side-by-side with agent chat):
   ```
   https://cash-agent-ui-rgw57p2taa-uc.a.run.app
   ```
   The UI connects to BigQuery via the ui-api service and shows live data.

5. **Verify data is loaded**:
   ```bash
   bash reset_demo.sh --verify
   ```
   You should see 7 seed tables with data and 0 rows in the 3 operational tables.

---

## Autonomous Agent Operations

Before diving into the interactive demo, highlight the autonomous capabilities:

> "This isn't just a chatbot — the agent runs autonomously on a schedule. Let me show you what it's already done today."

1. **Dashboard**: Point to the "Recent Agent Activity" section — it shows autonomous forecast updates, anomaly scans, and position checks from the agent runner's scheduled execution.

2. **Recommendations tab**: Click the Recommendations tab — the autonomous agent has already generated 2-4 recommendations based on today's data, complete with policy citations and priority rankings.

3. **Approvals tab**: If any recommendation exceeds $500K, the agent has already created an approval request — visible in the Approvals tab.

**Talking points**:
- Agents don't just respond to prompts — they work autonomously on schedule
- Cloud Scheduler triggers the agent runner every 2-4 hours
- Human-in-the-loop is preserved: high-value actions require approval even when running autonomously
- All autonomous actions are fully auditable

---

## Act 1 — Discovery: "What do we have?"

### Prompt 1: Cash Position

> **What's our current cash position across all bank accounts?**

**What happens**: Root agent delegates to `CashPositionAgent`, which queries BigQuery `bank_accounts` and `fx_rates` tables.

**Expected response** — 7 accounts grouped by currency:

| Currency | Bank | Account Type | Balance |
|----------|------|-------------|---------|
| USD | Chase | Checking | $5,200,000 |
| USD | Chase | Savings | $2,100,000 |
| USD | Bank of America | Checking | $3,800,000 |
| EUR | Deutsche Bank | Checking | EUR 4,500,000 |
| EUR | BNP Paribas | Checking | EUR 2,300,000 |
| GBP | Barclays | Checking | GBP 1,900,000 |
| GBP | Barclays | Money Market | GBP 1,200,000 |

**Totals**: USD $11.1M, EUR 6.8M (~$7.3M), GBP 3.1M (~$3.9M) = **~$22.4M total**

**Talking points**:
- Multi-agent delegation — root agent selected CashPositionAgent based on intent
- Real-time BigQuery queries, not cached reports
- Automatic FX conversion to USD equivalent using live rates (EUR/USD ~1.08, GBP/USD ~1.27)

**UI interaction**: Switch to the Dashboard tab — notice the same ~$22.4M total the agent just reported, with live currency breakdown cards and the forecast chart. The Dashboard already shows data from the autonomous agent's recent review.

---

### Prompt 2: Forecast

> **Show me the 30-day cash flow forecast**

**What happens**: Root agent delegates to `CashForecastAgent`, which calls BQML ARIMA+ model and cross-references AR/AP open items.

**Expected response** — Weekly breakdown of expected inflows vs outflows by currency, highlighting:
- Total AR (receivables) expected over 30 days
- Total AP (payables) + scheduled payment runs
- A projected **USD shortfall around Week 3** (large payment runs of $2.8M + $1.5M vs more moderate AR collections)

**Talking points**:
- BQML ARIMA+ model trained on `cash_journal` historical data — no ML infra needed
- AR items are probability-weighted (not all receivables are equally certain)
- Tease: "Let's see if there are any anomalies we should worry about"

**UI interaction**: The Dashboard's forecast chart shows the same BQML ARIMA+ projection with confidence intervals.

---

## Act 2 — Risk Detection: "What should worry us?"

### Prompt 3: Anomaly Detection

> **Check for any anomalies in our receivables and payables**

**What happens**: Root agent delegates to `AnomalyDetectionAgent`, which runs statistical analysis and scans AR/AP items.

**Expected response** — Key anomaly found:
- **HIGH severity**: ACME Corp (C-020) — EUR 2,300,000 receivable at only **45% probability** (vs typical 85-97%). Due tomorrow. This is a major enterprise delivery (Phase 3) with abnormally low collection confidence.

**Talking points**:
- The autonomous agent's anomaly scan already flagged this — check the Audit Trail
- Statistical basis: 45% probability is a clear outlier vs the 85-97% range of other receivables
- Quantified impact: EUR 2.3M at risk = $2.5M USD
- The agent doesn't just find numbers — it explains *why* something is anomalous

**UI interaction**: In the Dashboard, the Obligations table highlights the ACME Corp row with a warning indicator (low probability flag).

---

### Prompt 4: Recommendations

> **What are your recommendations?**

**What happens**: Root agent delegates to `RecommendationAgent`, which analyzes position + forecast + policies and returns a prioritized action list.

**Expected response** — 3 key recommendations:

1. **HIGH: Accelerate ACME Corp collection** (EUR 2.3M at risk)
   - Rationale: 45% probability on a EUR 2.3M receivable due tomorrow
   - Policy ref: Treasury Policy Section 2.3 (reserve monitoring)

2. **MEDIUM: Place EUR term deposit** (EUR surplus)
   - Rationale: EUR 6.8M balance significantly exceeds 120% of 30-day EUR obligations
   - Policy ref: Treasury Policy Section 3.1 (surplus > 120% threshold)
   - Note: Amount > $500K requires VP Treasury approval (Approval Matrix Section 2.1)

3. **MEDIUM: Hedge GBP FX exposure** (BAE Systems GBP 800,000)
   - Rationale: GBP 800K AP payment exceeds GBP 500K mandatory hedging threshold
   - Policy ref: FX Hedging Policy Section 2.1

**Talking points**:
- Every recommendation cites specific policy sections — not hallucinated rules
- Policies are searched via semantic search over markdown documents
- Priorities are data-driven: the ACME risk dwarfs the others

---

## Act 3 — Action: "Do something about it"

### Prompt 5: Trigger Approval Workflow (> $500K)

> **Execute the EUR term deposit for the surplus**

**What happens**: Root agent delegates to `ExecutionAgent`. Amount exceeds $500K threshold, so the agent creates a **formal approval request** instead of executing.

**Expected response**:
- Agent creates an approval request in `approval_requests` table
- Status: PENDING
- Required approver: VP Treasury (per Approval Matrix Section 2.1)
- The agent **does NOT execute** the deposit — it tells the user the request has been created

**Talking points**:
- **Human-in-the-loop**: The agent knows the $500K policy threshold and enforces it
- Three-tier authorization model:
  - Under $100K: automated execution
  - $100K-$500K: user confirmation required
  - Over $500K: formal approval workflow
- The agent is an *assistant*, not an autonomous actor

**UI interaction**: Switch to the **Approvals** tab — the pending approval request appears in real-time (the UI polls every 5 seconds).

---

### Prompt 6: Direct Execution ($100K-$500K band)

> **Transfer $200,000 from Chase checking to Chase savings**

**What happens**: $200K is in the $100K-$500K band. The agent asks for **user confirmation**, then executes upon approval.

**Expected response**:
1. Agent asks: "This transfer is $200,000. Please confirm you'd like to proceed."
2. After you confirm ("Yes" / "Proceed"):
   - Calls Bank API (`execute_transfer`) → gets confirmation number
   - Calls SAP API (`update_sap_posting`) → creates accounting entry
   - Calls `log_agent_action()` → writes to audit trail
   - Reports: confirmation ID, updated balances, SAP document number

**Talking points**:
- **Three-system integration** in one agent action: Bank API + SAP + audit log
- Mock services simulate real banking and ERP APIs (FastAPI on Cloud Run)
- Every action is fully auditable

---

## Act 4 — Governance: "Who approves what?"

### Prompt 7: Check Approvals

> **Show me pending approval requests**

**What happens**: Agent queries `approval_requests` table for PENDING items.

**Expected response**: The EUR deposit approval from Act 3, showing:
- Action: Place EUR term deposit
- Amount and currency
- Status: PENDING
- Required approver: VP Treasury
- Agent's rationale and policy citations

**Talking points**:
- Full audit trail of agent reasoning
- Approval queue is a standard BigQuery table — could integrate with any workflow system

---

### Manual Step: Approve the Request

**Option A — Use the Management UI (recommended for demos)**:
Switch to the **Approvals** tab in the UI and click **Approve** on the pending request. The approval writes directly to BigQuery.

**Option B — Approve via BQ SQL**:
```sql
UPDATE `cash-agent-demo.cash_agent_demo.approval_requests`
SET status = 'APPROVED',
    approved_by = 'VP Treasury (demo)',
    approved_at = CURRENT_TIMESTAMP()
WHERE status = 'PENDING';
```

---

### Prompt 8: Execute Approved Action

> **Now execute the approved EUR deposit**

**What happens**: Agent checks `approval_requests`, sees APPROVED status, and proceeds with execution.

**Expected response**:
- Calls Broker API (`place_deposit` or `place_investment`) → gets contract ID
- Calls SAP API → creates accounting entry
- Logs to audit trail
- Reports: contract number, maturity date, rate, SAP document

**Talking points**:
- Complete lifecycle: recommend → request approval → approve → execute → record
- Agent respects the approval gate — won't execute without it
- All three external systems updated atomically

---

## Act 5 (Bonus) — What-If: "What could go wrong?"

### Prompt 9: Scenario Simulation

> **What if ACME Corp doesn't pay and EUR/USD drops 5%?**

**What happens**: Root agent delegates to `ScenarioSimulationAgent`, which models the compound scenario.

**Expected response** — Base case vs scenario comparison:

| | Base Case | Scenario | Delta |
|---|-----------|----------|-------|
| EUR position | ~EUR X.XM | ~EUR X.XM | -EUR 2.3M |
| USD equivalent | ~$X.XM | ~$X.XM | ~-$2.6M |

- ACME non-payment removes EUR 1.035M expected inflow (2.3M * 0.45 probability)
- EUR/USD drop from 1.08 → 1.026 reduces USD value of all EUR holdings
- Combined impact: approximately **$2.6M negative delta**

**Talking points**:
- Pure Python scenario engine — no separate simulation service needed
- Compound scenarios (customer risk + FX risk) modeled together
- Quantified impact helps treasury make informed decisions

---

## Dual-Screen Demo Setup

For maximum impact, present with **two browser windows side by side**:

| Left Screen | Right Screen |
|-------------|-------------|
| Agent Chat (`adk web` or chat-app) | Management UI (cash-agent-ui) |

This lets the audience see the agent's analysis appear in real-time while the Management UI reflects the same live BigQuery data. Key moments:

1. **Act 1**: Agent reports cash position → Dashboard shows the same totals and forecast chart
2. **Act 2**: Agent detects ACME anomaly → Obligations table highlights the row with a warning icon
3. **Act 3**: Agent creates approval request → Approvals tab shows it within seconds (auto-refresh)
4. **Act 4**: Click Approve in the UI → Tell the agent to execute the approved action
5. **Act 5**: Agent runs scenario simulation → Dashboard remains as the reference for base-case comparison

---

## Wrap-Up Talking Points

### Architecture Highlights
- **Agentic architecture**: 1 root agent + 6 specialized sub-agents, 15+ tools
- **Autonomous operations**: Scheduled agent runner for continuous monitoring and recommendations
- **Policy grounding**: Semantic search over 3 markdown policy documents (treasury, FX hedging, approval matrix)
- **Human-in-the-loop**: Three-tier threshold model (auto / confirm / approve) — even for autonomous runs
- **Google Cloud native**: ADK, Vertex AI, BQML ARIMA+, BigQuery, Cloud Run, Cloud Scheduler

### Why This Matters
- **Not a chatbot** — an agent that can analyze, recommend, *and execute* real financial operations
- **Autonomous + interactive**: Runs on schedule AND responds to prompts
- **Policy-compliant by design** — every action is checked against corporate policies
- **Auditable** — full trail of agent reasoning, approvals, and execution confirmations
- **Composable** — sub-agents can be swapped, added, or promoted independently
- **Always-fresh data** — daily seed data refresh keeps the demo current

### Google Cloud Components Used
| Component | Role |
|-----------|------|
| ADK (Agent Development Kit) | Agent framework, orchestration |
| Vertex AI | LLM inference (Gemini) |
| BigQuery | Data warehouse, operational tables |
| BQML ARIMA+ | Time-series cash flow forecasting |
| Cloud Run | Mock services, UI, UI API, Chat App, Agent Runner |
| Cloud Scheduler | Autonomous agent execution + daily data refresh |
| Artifact Registry | Docker image management |

---

## Appendix

### Quick-Reference Prompt List

Copy-paste these prompts in order:

```
1. What's our current cash position across all bank accounts?
2. Show me the 30-day cash flow forecast
3. Check for any anomalies in our receivables and payables
4. What are your recommendations?
5. Execute the EUR term deposit for the surplus
6. Transfer $200,000 from Chase checking to Chase savings
7. Show me pending approval requests
   [manually approve in BQ]
8. Now execute the approved EUR deposit
9. What if ACME Corp doesn't pay and EUR/USD drops 5%?
```

### Key Data Points

| Data Point | Value | Source |
|-----------|-------|--------|
| Total cash position | ~$22.4M USD equivalent | bank_accounts |
| USD holdings | $11.1M (3 accounts) | bank_accounts |
| EUR holdings | EUR 6.8M (2 accounts) | bank_accounts |
| GBP holdings | GBP 3.1M (2 accounts) | bank_accounts |
| EUR/USD rate | ~1.08 | fx_rates |
| GBP/USD rate | ~1.27 | fx_rates |
| ACME Corp receivable | EUR 2,300,000 at 45% probability | ar_open_items |
| BAE Systems payable | GBP 800,000 | ap_open_items |
| Surplus threshold | 120% of 30-day obligations | Treasury Policy 3.1 |
| FX hedge threshold (GBP) | GBP 500,000 | FX Hedging Policy 2.1 |
| Auto-execute limit | < $100K | Approval Matrix 3.1 |
| Confirm limit | $100K-$500K | Approval Matrix 3.2 |
| Formal approval limit | > $500K | Approval Matrix 3.3 |

### Architecture Diagram

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

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent returns errors about missing tables | Run `bash reset_demo.sh --full` to reload seed data |
| "No FX rates found" | FX rates table uses date-based lookup; use "Full Reset" from the gear icon to regenerate with today's dates |
| Approval workflow not triggering | Ensure `approval_requests` table exists; run `--full` reset |
| BQML forecast unavailable | Model may need retraining; see `deploy.sh` step 6 |
| Slow responses on `adk web` | First query initializes connections; subsequent queries are faster |
| Mock service errors | Check Cloud Run services are running: `gcloud run services list` |
