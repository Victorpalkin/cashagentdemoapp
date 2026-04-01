"""Autonomous Agent Runner — runs treasury operations on schedule."""

import datetime
import json
import logging
import os
import random
import sys
import traceback

import requests
from fastapi import FastAPI
from google.cloud import bigquery
import vertexai
from vertexai.generative_models import GenerativeModel

# Import policy parser (copied into Docker image alongside main.py)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "data", "policies"))
try:
    import policy_parser
except ImportError:
    policy_parser = None  # type: ignore

PROJECT_ID = os.environ.get("PROJECT_ID", "cash-agent-demo")
DATASET_ID = os.environ.get("DATASET_ID", "cash_agent_demo")
REGION = os.environ.get("REGION", "us-central1")
BANK_API_URL = os.environ.get(
    "BANK_API_URL",
    "https://bank-api-mock-558326705804.us-central1.run.app",
)
BROKER_API_URL = os.environ.get(
    "BROKER_API_URL",
    "https://broker-api-mock-558326705804.us-central1.run.app",
)

app = FastAPI(title="Cash Agent Runner")
logger = logging.getLogger("agent_runner")
logging.basicConfig(level=logging.INFO)


def _table(name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET_ID}.{name}`"


def _bq_client():
    return bigquery.Client(project=PROJECT_ID)


# ---- BQ Helper Functions (mirror agent tools) ----

def get_cash_position():
    client = _bq_client()
    query = f"""
        WITH latest_fx AS (
            SELECT from_currency, to_currency, exchange_rate
            FROM {_table('fx_rates')}
            WHERE rate_date = (
                SELECT MAX(rate_date) FROM {_table('fx_rates')}
                WHERE rate_date <= CURRENT_DATE()
            )
        )
        SELECT b.bank_account_id, b.bank_name, b.account_type,
               b.currency, b.current_balance, b.last_updated,
               fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        JOIN {_table('gl_accounts')} g ON b.gl_account = g.gl_account
        LEFT JOIN latest_fx fx
            ON fx.from_currency = b.currency AND fx.to_currency = 'USD'
        ORDER BY b.currency, b.bank_name
    """
    rows = client.query(query).result()
    balances = []
    for row in rows:
        entry = dict(row)
        if entry["currency"] == "USD":
            entry["usd_equivalent"] = entry["current_balance"]
        elif entry.get("usd_rate"):
            entry["usd_equivalent"] = round(entry["current_balance"] * entry["usd_rate"], 2)
        balances.append(entry)
    return {"balances": balances}


def get_bank_balances():
    client = _bq_client()
    query = f"""
        WITH latest_fx AS (
            SELECT from_currency, to_currency, exchange_rate
            FROM {_table('fx_rates')}
            WHERE rate_date = (
                SELECT MAX(rate_date) FROM {_table('fx_rates')}
                WHERE rate_date <= CURRENT_DATE()
            )
        )
        SELECT b.currency, SUM(b.current_balance) AS total_balance,
               fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        LEFT JOIN latest_fx fx
            ON fx.from_currency = b.currency AND fx.to_currency = 'USD'
        GROUP BY b.currency, fx.exchange_rate
        ORDER BY b.currency
    """
    rows = client.query(query).result()
    totals = []
    grand = 0
    for row in rows:
        entry = dict(row)
        if entry["currency"] == "USD":
            entry["usd_equivalent"] = entry["total_balance"]
        elif entry.get("usd_rate"):
            entry["usd_equivalent"] = round(entry["total_balance"] * entry["usd_rate"], 2)
        grand += entry.get("usd_equivalent", 0)
        totals.append(entry)
    return {"currency_totals": totals, "grand_total_usd": round(grand, 2)}


def _cash_journal_subquery() -> str:
    return f"""SELECT posting_date, currency,
               SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
        FROM `{PROJECT_ID}.{DATASET_ID}.cash_journal`
        GROUP BY posting_date, currency"""


def get_forecast(horizon_days=30):
    client = _bq_client()
    query = f"""
        SELECT forecast_timestamp AS forecast_date,
               forecast_value AS net_cash_flow,
               confidence_level,
               prediction_interval_lower_bound AS lower_bound,
               prediction_interval_upper_bound AS upper_bound, currency
        FROM AI.FORECAST(
            ({_cash_journal_subquery()}),
            data_col => 'net_cash_flow',
            timestamp_col => 'posting_date',
            id_cols => ['currency'],
            horizon => {horizon_days},
            confidence_level => 0.95)
        ORDER BY currency, forecast_timestamp
    """
    try:
        rows = client.query(query).result()
        return {"forecasts": [dict(r) for r in rows], "horizon_days": horizon_days}
    except Exception as e:
        return {"error": str(e)}


def get_ar_open_items():
    client = _bq_client()
    query = f"""
        SELECT ar_item_id, customer_id, customer_name, invoice_number,
               amount, currency, due_date, probability, description
        FROM {_table('ar_open_items')} WHERE status = 'OPEN' ORDER BY due_date
    """
    rows = client.query(query).result()
    items = [dict(r) for r in rows]
    return {"items": items, "count": len(items)}


def get_ap_open_items():
    client = _bq_client()
    query = f"""
        SELECT ap_item_id, vendor_id, vendor_name, invoice_number,
               amount, currency, due_date, payment_method, description
        FROM {_table('ap_open_items')} WHERE status = 'OPEN' ORDER BY due_date
    """
    rows = client.query(query).result()
    items = [dict(r) for r in rows]
    return {"items": items, "count": len(items)}


def _build_policy_section() -> str:
    """Build the POLICIES section for the Gemini prompt from policy documents."""
    if not policy_parser:
        return """POLICIES (from corporate treasury policy documents):
- Treasury Policy Section 2.3: Receivables with probability < 60% represent collection risk.
- Treasury Policy Section 3.1: Surplus is cash balances exceeding 120% of 30-day obligations.
- FX Hedging Policy Section 2.1: Hedge when net FX obligation exceeds currency thresholds.
- Approval Matrix Section 3.1: Under $100,000 can be auto-executed.
- Approval Matrix Section 3.2: $100,000-$500,000 require user confirmation.
- Approval Matrix Section 3.3: Over $500,000 require formal VP Treasury approval."""

    policies = policy_parser.load_all_policies()
    sections = ["POLICIES (from corporate treasury policy documents):"]
    for fname, data in policies.items():
        display = fname.replace("_", " ").replace(".md", "").title()
        sections.append(f"\n--- {display} ---\n{data['body']}")
    return "\n".join(sections)


def detect_anomalies():
    client = _bq_client()
    anomalies = []

    # 1. TimesFM-based anomaly detection on cash journal
    ai_anomaly_query = f"""
        SELECT *
        FROM AI.DETECT_ANOMALIES(
            ({_cash_journal_subquery()}
             WHERE posting_date < DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)),
            ({_cash_journal_subquery()}
             WHERE posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)),
            data_col => 'net_cash_flow',
            timestamp_col => 'posting_date',
            id_cols => ['currency'],
            anomaly_prob_threshold => 0.95
        )
        WHERE is_anomaly = TRUE
        ORDER BY anomaly_probability DESC
    """
    try:
        ai_rows = [dict(r) for r in client.query(ai_anomaly_query).result()]
        for item in ai_rows:
            ts = item["time_series_timestamp"]
            if hasattr(ts, "strftime"):
                ts = ts.strftime("%Y-%m-%d")
            anomalies.append({
                "severity": "HIGH" if item["anomaly_probability"] > 0.99 else "MEDIUM",
                "type": "TIMESFM_CASH_FLOW_ANOMALY",
                "description": (
                    f"{item['currency']} net cash flow of {item['time_series_data']:,.0f} "
                    f"on {ts} is anomalous (probability {item['anomaly_probability']:.2%}, "
                    f"expected range {item['lower_bound']:,.0f} to {item['upper_bound']:,.0f})"
                ),
                "details": item,
            })
    except Exception:
        pass  # TimesFM anomaly detection unavailable

    # 2. Rule-based: risky AR items
    risky_ar = [dict(r) for r in client.query(f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN' AND probability < {policy_parser.get_collection_risk_threshold() if policy_parser else 0.6} ORDER BY amount DESC
    """).result()]

    for item in risky_ar:
        due = item["due_date"]
        if hasattr(due, "isoformat"):
            due = due.isoformat()
        anomalies.append({
            "severity": "HIGH" if item["amount"] > 1000000 else "MEDIUM",
            "type": "LOW_PROBABILITY_RECEIVABLE",
            "description": f"{item['customer_name']}: {item['currency']} {item['amount']:,.0f} due {due} with only {item['probability']*100:.0f}% probability",
            "details": item,
        })

    # 3. AP concentration — unusual weekly spikes
    try:
        ap_concentration_query = f"""
            WITH weekly_ap AS (
                SELECT
                    DATE_TRUNC(due_date, WEEK) AS week_start,
                    SUM(amount) AS weekly_total,
                    currency
                FROM {_table('ap_open_items')}
                WHERE status = 'OPEN'
                GROUP BY week_start, currency
            ),
            historical_avg AS (
                SELECT
                    currency,
                    AVG(weekly_total) AS avg_weekly,
                    STDDEV(weekly_total) AS stddev_weekly
                FROM weekly_ap
                GROUP BY currency
            )
            SELECT
                w.week_start, w.currency, w.weekly_total,
                h.avg_weekly,
                SAFE_DIVIDE(w.weekly_total - h.avg_weekly, h.stddev_weekly) AS z_score
            FROM weekly_ap w
            JOIN historical_avg h ON w.currency = h.currency
            WHERE SAFE_DIVIDE(w.weekly_total - h.avg_weekly, h.stddev_weekly) > 1.5
            ORDER BY z_score DESC
        """
        ap_conc_rows = [dict(r) for r in client.query(ap_concentration_query).result()]
        for item in ap_conc_rows:
            ws = item["week_start"]
            if hasattr(ws, "strftime"):
                ws = ws.strftime("%Y-%m-%d")
            anomalies.append({
                "severity": "MEDIUM",
                "type": "AP_CONCENTRATION",
                "description": (
                    f"Week of {ws}: {item['currency']} "
                    f"{item['weekly_total']:,.0f} in AP payments "
                    f"({item['z_score']:.1f} std devs above average)"
                ),
                "details": item,
            })
    except Exception:
        pass

    # 4. FX exposure breach — net foreign currency obligation exceeds hedging threshold
    HEDGE_THRESHOLDS = policy_parser.get_hedge_thresholds() if policy_parser else {
        'EUR': 750000, 'GBP': 500000, 'JPY': 50000000,
        'CHF': 500000, 'SGD': 500000, 'AUD': 500000,
    }
    try:
        ap_by_cur = {}
        for r in client.query(f"""
            SELECT currency, SUM(amount) AS total
            FROM {_table('ap_open_items')} WHERE status = 'OPEN'
            GROUP BY currency
        """).result():
            ap_by_cur[r["currency"]] = r["total"]

        ar_weighted_by_cur = {}
        for r in client.query(f"""
            SELECT currency, SUM(amount * probability) AS total
            FROM {_table('ar_open_items')} WHERE status = 'OPEN'
            GROUP BY currency
        """).result():
            ar_weighted_by_cur[r["currency"]] = r["total"]

        for cur, threshold in HEDGE_THRESHOLDS.items():
            net_obligation = (ap_by_cur.get(cur, 0) - ar_weighted_by_cur.get(cur, 0))
            if net_obligation > threshold:
                anomalies.append({
                    "severity": "HIGH" if net_obligation > threshold * 2 else "MEDIUM",
                    "type": "FX_EXPOSURE_BREACH",
                    "description": (
                        f"{cur} net FX obligation of {net_obligation:,.0f} "
                        f"exceeds hedging threshold of {threshold:,.0f} "
                        f"(AP: {ap_by_cur.get(cur, 0):,.0f}, "
                        f"weighted AR: {ar_weighted_by_cur.get(cur, 0):,.0f})"
                    ),
                    "details": {
                        "currency": cur,
                        "net_obligation": net_obligation,
                        "threshold": threshold,
                        "ap_total": ap_by_cur.get(cur, 0),
                        "ar_weighted": ar_weighted_by_cur.get(cur, 0),
                    },
                })
    except Exception:
        pass

    # 5. Payment spike — next 7 days AP exceeds 2x weekly average
    try:
        spike_query = f"""
            WITH next_7_days AS (
                SELECT currency, SUM(amount) AS upcoming_total
                FROM {_table('ap_open_items')}
                WHERE status = 'OPEN'
                  AND due_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
                GROUP BY currency
            ),
            weekly_avg AS (
                SELECT currency, AVG(amount) * 5 AS avg_weekly_total
                FROM {_table('ap_open_items')}
                WHERE status = 'OPEN'
                GROUP BY currency
            )
            SELECT n.currency, n.upcoming_total, w.avg_weekly_total
            FROM next_7_days n
            JOIN weekly_avg w ON n.currency = w.currency
            WHERE n.upcoming_total > w.avg_weekly_total * 2
        """
        for r in client.query(spike_query).result():
            anomalies.append({
                "severity": "HIGH",
                "type": "PAYMENT_SPIKE",
                "description": (
                    f"{r['currency']} has {r['upcoming_total']:,.0f} in AP due within 7 days, "
                    f"which is more than 2x the weekly average of {r['avg_weekly_total']:,.0f}"
                ),
                "details": dict(r),
            })
    except Exception:
        pass

    anomalies.sort(key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["severity"]])
    return {"anomalies": anomalies, "count": len(anomalies)}


def get_fx_rates():
    client = _bq_client()
    query = f"""
        SELECT from_currency, to_currency, exchange_rate, rate_date
        FROM {_table('fx_rates')}
        WHERE rate_date = (
            SELECT MAX(rate_date) FROM {_table('fx_rates')}
            WHERE rate_date <= CURRENT_DATE()
        )
        ORDER BY from_currency, to_currency
    """
    rows = client.query(query).result()
    return {"rates": [dict(r) for r in rows]}


def get_payment_runs():
    client = _bq_client()
    query = f"""
        SELECT payment_run_id, scheduled_date, total_amount, currency,
               item_count, status, description
        FROM {_table('payment_runs')}
        WHERE status = 'SCHEDULED'
        ORDER BY scheduled_date
    """
    rows = client.query(query).result()
    return {"payment_runs": [dict(r) for r in rows]}


def log_agent_action(agent_name, action, tool_name, input_summary, output_summary):
    client = _bq_client()
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.agent_audit_log"
    errors = client.insert_rows_json(table_ref, [{
        "agent_name": agent_name,
        "action": action,
        "tool_name": tool_name,
        "input_summary": input_summary,
        "output_summary": output_summary,
    }])
    if errors:
        logger.error(f"Audit log error: {errors}")
    return {"status": "logged" if not errors else "error"}


def create_approval_request(action_type, amount, currency, description, reasoning):
    client = _bq_client()
    request_id = f"APR-2026-{random.randint(1000, 9999):04d}"
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.approval_requests"
    query = f"""
        INSERT INTO `{table_ref}`
        (request_id, action_type, amount, currency, description, agent_reasoning, status, requested_at, requested_by)
        VALUES
        (@request_id, @action_type, @amount, @currency, @description, @agent_reasoning, 'PENDING', @requested_at, 'autonomous_agent_runner')
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            bigquery.ScalarQueryParameter("action_type", "STRING", action_type),
            bigquery.ScalarQueryParameter("amount", "FLOAT64", amount),
            bigquery.ScalarQueryParameter("currency", "STRING", currency),
            bigquery.ScalarQueryParameter("description", "STRING", description),
            bigquery.ScalarQueryParameter("agent_reasoning", "STRING", reasoning),
            bigquery.ScalarQueryParameter("requested_at", "STRING", datetime.datetime.now().isoformat()),
        ]
    )
    try:
        client.query(query, job_config=job_config).result()
        return {"request_id": request_id, "status": "pending_approval"}
    except Exception as e:
        logger.error(f"Approval request insert error: {e}")
        return {"request_id": request_id, "status": "error"}


def insert_recommendation(rec):
    client = _bq_client()
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.agent_recommendations"
    errors = client.insert_rows_json(table_ref, [rec])
    if errors:
        logger.error(f"Recommendation insert error: {errors}")
    return not errors


def execute_recommendation(action_type, amount, currency, description):
    """Call mock bank/broker API to execute a financial action."""
    try:
        if action_type == "PLACE_DEPOSIT":
            resp = requests.post(f"{BANK_API_URL}/deposits", json={
                "bank_name": "Deutsche Bank",
                "currency": currency,
                "amount": amount,
                "term_days": 30,
                "rate_pct": 4.2,
            }, timeout=10)
            result = resp.json()
        elif action_type in ("HEDGE_FX", "SPOT_FX_REBALANCE"):
            trade_type = "spot" if action_type == "SPOT_FX_REBALANCE" else "forward"
            resp = requests.post(f"{BROKER_API_URL}/fx-trades", json={
                "buy_currency": currency if trade_type == "spot" else "USD",
                "sell_currency": "USD" if trade_type == "spot" else currency,
                "buy_amount": amount,
                "trade_type": trade_type,
                "settlement_days": 2 if trade_type == "spot" else 21,
            }, timeout=10)
            result = resp.json()
        elif action_type == "INTERBANK_SWEEP":
            resp = requests.post(f"{BANK_API_URL}/transfers", json={
                "from_bank": "Chase",
                "to_bank": "Bank of America",
                "currency": currency,
                "amount": amount,
                "reference": f"Auto-sweep {description}",
            }, timeout=10)
            result = resp.json()
        elif action_type == "EARLY_PAYMENT_DISCOUNT":
            result = {
                "status": "confirmed",
                "action": action_type,
                "confirmation_id": f"EPD-{random.randint(100000, 999999)}",
                "description": description,
                "discount_captured": round(amount * 0.02, 2),
                "currency": currency,
                "amount": amount,
            }
        else:
            result = {
                "status": "noted",
                "action": action_type,
                "confirmation_id": f"ACT-{random.randint(100000, 999999)}",
                "description": description,
            }

        log_agent_action(
            "autonomous_runner", "EXECUTE", action_type.lower(),
            f"{currency} {amount:,.0f} - {description}",
            json.dumps(result, default=str),
        )
        return result
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        return {"status": "error", "error": str(e)}


def get_agent_memories():
    """Fetch active agent memories from BigQuery."""
    client = _bq_client()
    query = f"""
        SELECT memory_id, source, category, content,
               related_action_type, related_entity, created_by
        FROM {_table('agent_memory')}
        WHERE is_active = TRUE
        ORDER BY created_at DESC
    """
    try:
        rows = client.query(query).result()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Failed to fetch agent memories: {e}")
        return []


def _serialize_for_prompt(data):
    """Make data JSON-serializable for Gemini prompt."""
    def _convert(obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, float):
            return round(obj, 2)
        return obj

    if isinstance(data, dict):
        return {k: _convert(v) if not isinstance(v, (dict, list)) else _serialize_for_prompt(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_serialize_for_prompt(item) if isinstance(item, (dict, list)) else _convert(item) for item in data]
    return _convert(data)


# ---- Endpoints ----

@app.get("/health")
def health():
    return {"status": "healthy", "service": "agent-runner"}


@app.post("/run/daily-review")
async def daily_review():
    """Full autonomous daily review cycle."""
    results = {"steps": [], "recommendations_created": 0, "errors": []}

    try:
        # Step 1: Position check
        position = get_cash_position()
        balances = get_bank_balances()
        position_summary = f"Total: ${balances['grand_total_usd']:,.0f} across {len(position['balances'])} accounts"
        log_agent_action("autonomous_runner", "QUERY", "get_cash_position", "Daily position check", position_summary)
        results["steps"].append({"step": "position_check", "summary": position_summary})

        # Step 2: Forecast + AR/AP
        forecast = get_forecast(30)
        ar = get_ar_open_items()
        ap = get_ap_open_items()

        ar_total = sum(item["amount"] for item in ar["items"])
        ap_total = sum(item["amount"] for item in ap["items"])
        forecast_summary = f"AR: {ar['count']} items, AP: {ap['count']} items"
        if "error" not in forecast:
            forecast_summary += f", TimesFM forecast: {len(forecast.get('forecasts', []))} data points"
        log_agent_action("autonomous_runner", "ANALYZE", "get_forecast", "30-day forecast analysis", forecast_summary)
        results["steps"].append({"step": "forecast", "summary": forecast_summary})

        # Step 3: Anomaly scan
        anomalies = detect_anomalies()
        anomaly_summary = f"Found {anomalies['count']} anomalies"
        if anomalies["anomalies"]:
            high = [a for a in anomalies["anomalies"] if a["severity"] == "HIGH"]
            anomaly_summary += f" ({len(high)} HIGH severity)"
        log_agent_action("autonomous_runner", "ANALYZE", "detect_anomalies", "Anomaly scan", anomaly_summary)
        results["steps"].append({"step": "anomaly_scan", "summary": anomaly_summary})

        # Step 4: Generate recommendations via Gemini
        fx = get_fx_rates()
        payment_runs = get_payment_runs()

        # Build context for Gemini
        context_data = _serialize_for_prompt({
            "bank_balances": balances,
            "ar_items": ar["items"],
            "ap_items": ap["items"],
            "payment_runs": payment_runs["payment_runs"],
            "anomalies": anomalies["anomalies"],
            "fx_rates": fx["rates"],
        })

        # Fetch agent memories
        memories = get_agent_memories()
        memories_section = ""
        if memories:
            memories_section = f"""
AGENT MEMORY (past decisions and preferences from VP Treasury — you MUST respect these):
{json.dumps(memories, indent=2, default=str)}

When generating recommendations, check each against these memories. If a memory contradicts what you would normally recommend, adjust accordingly and cite the relevant memory in your rationale.
"""

        prompt = f"""You are an autonomous treasury cash management agent for a company whose FUNCTIONAL CURRENCY is USD. EUR, GBP, JPY, CHF, SGD, and AUD are foreign currencies. The company operates across 14 bank accounts globally.

Based on the following data, generate between 5 and 7 actionable recommendations, including a mix of large actions requiring approval and small routine actions (under $100,000 USD equivalent) that can be auto-executed without human intervention.

DATA:
{json.dumps(context_data, indent=2, default=str)}

{_build_policy_section()}
{memories_section}
ANALYSIS INSTRUCTIONS:
1. Check anomalies first — each HIGH severity anomaly MUST produce a corresponding recommendation:
   - LOW_PROBABILITY_RECEIVABLE → ACCELERATE_COLLECTION (for the specific customer)
   - AP_CONCENTRATION → INTERBANK_SWEEP or liquidity action to ensure coverage
   - FX_EXPOSURE_BREACH → HEDGE_FX (forward or spot depending on amount)
   - TIMESFM_CASH_FLOW_ANOMALY → investigate and recommend corrective action
   - PAYMENT_SPIKE → ensure liquidity coverage, recommend transfer if needed
   For each anomaly-driven recommendation, you MUST set source_anomaly_type and source_anomaly_description.

2. Calculate 30-day obligations per currency = sum of AP items + scheduled payment runs in that currency. Compare bank balances to 120% of obligations to find surplus currencies. Surplus investment is MEDIUM priority.

3. Calculate net FX exposure per FOREIGN currency = AP total - probability-weighted AR total. Check against hedging thresholds. FX hedging is MEDIUM priority.

4. Do NOT recommend hedging USD — it is the functional currency.

5. Identify 2-3 small auto-executable opportunities (under $100K USD equivalent):
   - Small FX spot trades to rebalance minor currency positions (action_type: SPOT_FX_REBALANCE)
   - Small interbank sweeps between accounts of the same currency (action_type: INTERBANK_SWEEP)
   - Early payment discount captures for AP items offering 2/10 net 30 terms (action_type: EARLY_PAYMENT_DISCOUNT)
   - Small overnight deposits for idle cash in secondary currencies (action_type: PLACE_DEPOSIT)

Return between 5 and 7 recommendations as a JSON array. Each must have:
- "priority": "HIGH" for anomaly-driven actions, "MEDIUM" for surplus/hedging, "LOW" for small optimizations
- "action_type": one of "PLACE_DEPOSIT", "HEDGE_FX", "ACCELERATE_COLLECTION", "INTERBANK_SWEEP", "SPOT_FX_REBALANCE", "EARLY_PAYMENT_DISCOUNT", "PLACE_INVESTMENT"
- "amount": number (the recommended action amount in the specified currency)
- "currency": the currency code (USD, EUR, GBP, JPY, CHF, SGD, or AUD)
- "description": short human-readable description
- "rationale": detailed reasoning citing specific policy sections and computed values (show the math)
- "source_anomaly_type": if this recommendation was triggered by an anomaly, the anomaly type (e.g. "TIMESFM_CASH_FLOW_ANOMALY", "LOW_PROBABILITY_RECEIVABLE", "AP_CONCENTRATION", "FX_EXPOSURE_BREACH", "PAYMENT_SPIKE"), otherwise null
- "source_anomaly_description": if triggered by an anomaly, a short description of the anomaly, otherwise null

Return ONLY the JSON array, no other text."""

        try:
            vertexai.init(project=PROJECT_ID, location="global")
            model = GenerativeModel("gemini-3-flash-preview")
            response = model.generate_content(prompt)

            # Parse recommendations from Gemini
            response_text = response.text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]
                response_text = response_text.rsplit("```", 1)[0]

            recommendations = json.loads(response_text)

            # Clear old non-dismissed recommendations and their pending approvals
            client = _bq_client()
            client.query(f"""
                DELETE FROM {_table('approval_requests')}
                WHERE status = 'PENDING'
                AND request_id IN (
                    SELECT approval_request_id FROM {_table('agent_recommendations')}
                    WHERE status != 'DISMISSED'
                    AND approval_request_id IS NOT NULL AND approval_request_id != ''
                )
            """).result()
            client.query(f"""
                DELETE FROM {_table('agent_recommendations')}
                WHERE status != 'DISMISSED'
            """).result()

            rec_count = 0
            for i, rec in enumerate(recommendations):
                rec_id = f"REC-{datetime.date.today().strftime('%Y%m%d')}-{i+1:03d}"
                amount = rec.get("amount", 0)

                # Determine status based on amount vs policy thresholds
                _formal_min = policy_parser.get_formal_approval_min() if policy_parser else 500000
                _auto_max = policy_parser.get_auto_execute_max() if policy_parser else 100000
                if amount > _formal_min:
                    status = "PENDING_APPROVAL"
                elif amount > _auto_max:
                    status = "RECOMMENDED"
                else:
                    status = "AUTO_EXECUTED"

                approval_id = None
                if status == "PENDING_APPROVAL":
                    apr = create_approval_request(
                        rec.get("action_type", "UNKNOWN"),
                        amount,
                        rec.get("currency", "USD"),
                        rec.get("description", ""),
                        rec.get("rationale", ""),
                    )
                    approval_id = apr.get("request_id")

                row = {
                    "recommendation_id": rec_id,
                    "created_at": datetime.datetime.now().isoformat(),
                    "priority": rec.get("priority", "MEDIUM"),
                    "action_type": rec.get("action_type", "UNKNOWN"),
                    "amount": amount,
                    "currency": rec.get("currency", "USD"),
                    "description": rec.get("description", ""),
                    "rationale": rec.get("rationale", ""),
                    "status": status,
                    "approval_request_id": approval_id or "",
                    "source_anomaly_type": rec.get("source_anomaly_type") or "",
                    "source_anomaly_description": rec.get("source_anomaly_description") or "",
                }
                insert_recommendation(row)

                # Auto-execute low-value recommendations immediately
                if status == "AUTO_EXECUTED":
                    execute_recommendation(
                        rec.get("action_type", "UNKNOWN"),
                        amount,
                        rec.get("currency", "USD"),
                        rec.get("description", ""),
                    )

                rec_count += 1

                log_agent_action(
                    "autonomous_runner", "RECOMMEND", "generate_recommendation",
                    f"{rec.get('action_type')}: {rec.get('currency')} {amount:,.0f}",
                    f"{rec.get('description')} [Status: {status}]"
                )

            results["recommendations_created"] = rec_count
            results["steps"].append({"step": "recommendations", "summary": f"Created {rec_count} recommendations"})

        except Exception as e:
            logger.error(f"Gemini recommendation generation failed: {e}")
            results["errors"].append(f"Recommendation generation: {str(e)}")
            log_agent_action("autonomous_runner", "ERROR", "generate_recommendations", "Gemini call failed", str(e))

    except Exception as e:
        logger.error(f"Daily review failed: {traceback.format_exc()}")
        results["errors"].append(str(e))

    return results


@app.post("/run/forecast")
async def run_forecast():
    """Run forecast using TimesFM via AI.FORECAST (no model training needed)."""
    results = {"steps": []}

    try:
        forecast = get_forecast(30)
        summary = f"{len(forecast.get('forecasts', []))} forecast data points" if "error" not in forecast else forecast["error"]
        log_agent_action("autonomous_runner", "QUERY", "get_forecast", "30-day forecast", summary)
        results["steps"].append({"step": "forecast", "summary": summary})

    except Exception as e:
        logger.error(f"Forecast failed: {e}")
        results["error"] = str(e)

    return results


@app.post("/run/anomaly-scan")
async def anomaly_scan():
    """Quick anomaly detection scan."""
    try:
        anomalies = detect_anomalies()

        for anomaly in anomalies["anomalies"]:
            log_agent_action(
                "autonomous_runner", "ANALYZE", "detect_anomalies",
                f"Anomaly: {anomaly['type']}",
                anomaly["description"]
            )

        summary = f"Scan complete: {anomalies['count']} anomalies detected"
        log_agent_action("autonomous_runner", "ANALYZE", "anomaly_scan", "Scheduled scan", summary)

        return {"anomalies": anomalies["count"], "details": anomalies["anomalies"]}
    except Exception as e:
        logger.error(f"Anomaly scan failed: {e}")
        return {"error": str(e)}


@app.post("/run/refresh-data")
async def refresh_data():
    """Refresh seed data with today's dates."""
    try:
        from refresh_data import refresh_all_data
        result = refresh_all_data(PROJECT_ID, DATASET_ID)
        log_agent_action("autonomous_runner", "EXECUTE", "refresh_seed_data", "Daily data refresh", f"Refreshed {result.get('tables_loaded', 0)} tables")
        return result
    except Exception as e:
        logger.error(f"Data refresh failed: {traceback.format_exc()}")
        return {"error": str(e)}
