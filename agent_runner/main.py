"""Autonomous Agent Runner — runs treasury operations on schedule."""

import datetime
import json
import logging
import os
import random
import traceback

from fastapi import FastAPI
from google.cloud import bigquery
import vertexai
from vertexai.generative_models import GenerativeModel

PROJECT_ID = os.environ.get("PROJECT_ID", "cash-agent-demo")
DATASET_ID = os.environ.get("DATASET_ID", "cash_agent_demo")
REGION = os.environ.get("REGION", "us-central1")

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
        SELECT b.bank_account_id, b.bank_name, b.account_type,
               b.currency, b.current_balance, b.last_updated,
               fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        JOIN {_table('gl_accounts')} g ON b.gl_account = g.gl_account
        LEFT JOIN {_table('fx_rates')} fx
            ON fx.from_currency = b.currency AND fx.to_currency = 'USD'
            AND fx.rate_date = CURRENT_DATE()
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
        SELECT b.currency, SUM(b.current_balance) AS total_balance,
               fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        LEFT JOIN {_table('fx_rates')} fx
            ON fx.from_currency = b.currency AND fx.to_currency = 'USD'
            AND fx.rate_date = CURRENT_DATE()
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


def get_forecast(horizon_days=30):
    client = _bq_client()
    query = f"""
        SELECT forecast_timestamp AS forecast_date,
               forecast_value AS net_cash_flow, standard_error,
               confidence_level,
               prediction_interval_lower_bound AS lower_bound,
               prediction_interval_upper_bound AS upper_bound, currency
        FROM ML.FORECAST(
            MODEL `{PROJECT_ID}.{DATASET_ID}.cash_forecast_model`,
            STRUCT({horizon_days} AS horizon, 0.95 AS confidence_level))
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


def detect_anomalies():
    client = _bq_client()
    risky_ar = [dict(r) for r in client.query(f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN' AND probability < 0.6 ORDER BY amount DESC
    """).result()]

    anomalies = []
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
    return {"anomalies": anomalies, "count": len(anomalies)}


def get_fx_rates():
    client = _bq_client()
    query = f"""
        SELECT from_currency, to_currency, exchange_rate, rate_date
        FROM {_table('fx_rates')}
        WHERE rate_date = CURRENT_DATE()
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
    errors = client.insert_rows_json(table_ref, [{
        "request_id": request_id,
        "action_type": action_type,
        "amount": amount,
        "currency": currency,
        "description": description,
        "agent_reasoning": reasoning,
        "status": "PENDING",
        "requested_at": datetime.datetime.now().isoformat(),
        "requested_by": "autonomous_agent_runner",
    }])
    return {"request_id": request_id, "status": "error" if errors else "pending_approval"}


def insert_recommendation(rec):
    client = _bq_client()
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.agent_recommendations"
    errors = client.insert_rows_json(table_ref, [rec])
    if errors:
        logger.error(f"Recommendation insert error: {errors}")
    return not errors


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
            forecast_summary += f", BQML forecast: {len(forecast.get('forecasts', []))} data points"
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

        prompt = f"""You are an autonomous treasury cash management agent for a company whose FUNCTIONAL CURRENCY is USD. EUR and GBP are foreign currencies. Based on the following data, generate exactly 3 actionable recommendations.

DATA:
{json.dumps(context_data, indent=2, default=str)}

POLICIES (from corporate treasury policy documents):
- Treasury Policy Section 2.3: Receivables with probability < 60% represent collection risk and must be escalated to VP Treasury immediately.
- Treasury Policy Section 3.1: Surplus is defined as cash balances exceeding 120% of the next 30 days' projected obligations for a given currency. Surplus funds should be invested in approved short-term instruments.
- FX Hedging Policy Section 2.1: FX exposures in FOREIGN currencies (EUR, GBP — NOT USD) must be hedged when net obligation exceeds EUR 750,000 or GBP 500,000. "Net obligation" = AP total minus probability-weighted AR total in that currency.
- Approval Matrix Section 3.3: Transactions > $500,000 USD equivalent require formal VP Treasury approval.
- Approval Matrix Section 3.2: Transactions $100,000-$500,000 require user confirmation.

ANALYSIS INSTRUCTIONS:
1. Check anomalies first: any receivable with probability < 60% is HIGH priority for collection acceleration.
2. Calculate 30-day obligations per currency = sum of AP items + scheduled payment runs in that currency. Compare bank balances to 120% of obligations to find surplus currencies. Surplus investment is MEDIUM priority.
3. Calculate net FX exposure per FOREIGN currency (EUR, GBP) = AP total - probability-weighted AR total. Check against hedging thresholds. FX hedging is MEDIUM priority.
4. Do NOT recommend hedging USD — it is the functional currency.

Return exactly 3 recommendations as a JSON array. Each must have:
- "priority": "HIGH" for collection risks, "MEDIUM" for surplus investment and FX hedging
- "action_type": one of "PLACE_DEPOSIT", "HEDGE_FX", "ACCELERATE_COLLECTION"
- "amount": number (the recommended action amount)
- "currency": "USD" | "EUR" | "GBP"
- "description": short human-readable description
- "rationale": detailed reasoning citing specific policy sections and computed values (show the math)

Return ONLY the JSON array, no other text."""

        try:
            vertexai.init(project=PROJECT_ID, location=REGION)
            model = GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(prompt)

            # Parse recommendations from Gemini
            response_text = response.text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]
                response_text = response_text.rsplit("```", 1)[0]

            recommendations = json.loads(response_text)

            rec_count = 0
            for i, rec in enumerate(recommendations):
                rec_id = f"REC-{datetime.date.today().strftime('%Y%m%d')}-{i+1:03d}"
                amount = rec.get("amount", 0)

                # Determine status based on amount
                if amount > 500000:
                    status = "PENDING_APPROVAL"
                elif amount > 100000:
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
                }
                insert_recommendation(row)
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
    """Refresh forecast data."""
    results = {"steps": []}

    try:
        # Retrain BQML model
        client = _bq_client()
        retrain_sql = f"""
            CREATE OR REPLACE MODEL `{PROJECT_ID}.{DATASET_ID}.cash_forecast_model`
            OPTIONS(
                model_type='ARIMA_PLUS',
                time_series_timestamp_col='posting_date',
                time_series_data_col='net_cash_flow',
                time_series_id_col='currency',
                horizon=90,
                auto_arima=TRUE
            ) AS
            SELECT posting_date, currency,
                   SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
            FROM `{PROJECT_ID}.{DATASET_ID}.cash_journal`
            GROUP BY posting_date, currency
        """
        client.query(retrain_sql).result()
        log_agent_action("autonomous_runner", "EXECUTE", "retrain_bqml_model", "ARIMA+ model retrain", "Model retrained successfully")
        results["steps"].append({"step": "retrain_model", "status": "success"})

        # Run forecast
        forecast = get_forecast(30)
        summary = f"{len(forecast.get('forecasts', []))} forecast data points" if "error" not in forecast else forecast["error"]
        log_agent_action("autonomous_runner", "QUERY", "get_forecast", "30-day forecast", summary)
        results["steps"].append({"step": "forecast", "summary": summary})

    except Exception as e:
        logger.error(f"Forecast refresh failed: {e}")
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
