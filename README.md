# Cash Agent Demo

AI-powered treasury cash management with Google Cloud.

<!-- screenshot of Dashboard -->

## What It Does

- **Multi-currency cash management** -- monitors $22M+ across USD, EUR, and GBP accounts with real-time FX conversion and position tracking
- **ML-enriched forecasting** -- combines BQML ARIMA+ time-series predictions with agent analysis of AR probabilities, AP schedules, and payment runs to surface risks invisible to ML alone
- **Policy-grounded recommendations** -- generates prioritized actions (deposits, FX hedges, collection alerts) citing specific corporate policy sections, with full rationale
- **Human-in-the-loop execution** -- three-tier authorization (auto-execute < $100K, confirm < $500K, formal approval > $500K) for trades, transfers, and SAP postings

## Architecture

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

| Component | Role |
|-----------|------|
| ADK (Agent Development Kit) | Agent framework and multi-agent orchestration |
| Vertex AI (Gemini) | LLM inference for all agents |
| BigQuery | Data warehouse and operational tables |
| BQML ARIMA+ | Time-series cash flow forecasting model |
| Cloud Run | UI, API, agent runner, and mock banking/ERP services |
| Cloud Scheduler | Autonomous agent execution and daily data refresh |

## Project Structure

```
agent/              Root agent + 6 sub-agents, tool definitions
agent_runner/       Autonomous scheduled operations (daily review, anomaly scan)
chat_app/           Standalone chat interface
data/seed/          Seed data CSVs and generator script
data/policies/      Treasury, FX hedging, and approval matrix policies
ui/                 React + MUI management dashboard
ui_api/             FastAPI backend for the dashboard
mock_services/      SAP, bank, and broker API simulators
terraform/          Infrastructure as code (Cloud Run, BigQuery, Scheduler)
notebooks/          Jupyter notebooks for exploration
```

## Quick Start

**Agent (local)**:
```bash
pip install -r agent/requirements.txt
cd agent && adk web
```

**Management UI (local)**:
```bash
cd ui && npm install && npm run dev
```

**UI API**:
```bash
pip install -r ui_api/requirements.txt
uvicorn ui_api.main:app --port 8080
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for full GCP deployment instructions using Terraform and Cloud Run.

## Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a guided 15-20 minute walkthrough framed as a business story.

## Key Technologies

ADK, Vertex AI (Gemini), BQML ARIMA+, BigQuery, Cloud Run, Cloud Scheduler, React, FastAPI
