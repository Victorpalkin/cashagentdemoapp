"""UI Backend API — FastAPI service that queries BigQuery for the management UI."""

import datetime
import hashlib
import json
import logging
import os
import random
import time
import urllib.request
import urllib.error

from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import bigquery
import vertexai
from vertexai.generative_models import GenerativeModel

PROJECT_ID = os.environ.get("PROJECT_ID", "cash-agent-demo")
DATASET_ID = os.environ.get("DATASET_ID", "cash_agent_demo")
AGENT_RUNNER_URL = os.environ.get(
    "AGENT_RUNNER_URL",
    "https://agent-runner-558326705804.us-central1.run.app",
)
BANK_API_URL = os.environ.get(
    "BANK_API_URL",
    "https://bank-api-mock-558326705804.us-central1.run.app",
)
BROKER_API_URL = os.environ.get(
    "BROKER_API_URL",
    "https://broker-api-mock-558326705804.us-central1.run.app",
)

REGION = os.environ.get("REGION", "us-central1")

logger = logging.getLogger("ui_api")

# In-memory cache for Gemini anomaly explanations (hash -> (timestamp, explanations))
_explanation_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 300  # 5 minutes

app = FastAPI(title="Cash Agent UI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _table(name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET_ID}.{name}`"


def _serialize(rows):
    """Convert BigQuery rows to JSON-serializable dicts."""
    items = []
    for row in rows:
        entry = dict(row)
        for k, v in entry.items():
            if isinstance(v, (datetime.date, datetime.datetime)):
                entry[k] = v.isoformat()
        items.append(entry)
    return items


# ---- Cash Position ----

@app.get("/api/cash-position")
def cash_position():
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        WITH latest_fx AS (
            SELECT from_currency, to_currency, exchange_rate
            FROM {_table('fx_rates')}
            WHERE rate_date = (
                SELECT MAX(rate_date) FROM {_table('fx_rates')}
                WHERE rate_date <= CURRENT_DATE()
            )
        )
        SELECT
            b.bank_account_id, b.bank_name, b.account_type,
            b.currency, b.current_balance, b.last_updated,
            fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        JOIN {_table('gl_accounts')} g ON b.gl_account = g.gl_account
        LEFT JOIN latest_fx fx
            ON fx.from_currency = b.currency
            AND fx.to_currency = 'USD'
        ORDER BY b.currency, b.bank_name
    """
    rows = client.query(query).result()
    balances = []
    currency_totals: dict[str, dict] = {}
    for row in rows:
        entry = dict(row)
        for k, v in entry.items():
            if isinstance(v, (datetime.date, datetime.datetime)):
                entry[k] = v.isoformat()
        if entry["currency"] == "USD":
            entry["usd_equivalent"] = entry["current_balance"]
        elif entry.get("usd_rate"):
            entry["usd_equivalent"] = round(
                entry["current_balance"] * entry["usd_rate"], 2
            )
        else:
            entry["usd_equivalent"] = 0
        balances.append(entry)
        cur = entry["currency"]
        if cur not in currency_totals:
            currency_totals[cur] = {"currency": cur, "balance": 0, "usdEquivalent": 0}
        currency_totals[cur]["balance"] += entry["current_balance"]
        currency_totals[cur]["usdEquivalent"] += entry["usd_equivalent"]

    # Compute weekly change from cash_journal
    change_query = f"""
        SELECT currency,
            SUM(CASE WHEN posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                THEN CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END ELSE 0 END) AS this_week,
            SUM(CASE WHEN posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                AND posting_date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                THEN CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END ELSE 0 END) AS last_week
        FROM {_table('cash_journal')}
        WHERE posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        GROUP BY currency
    """
    change_pcts: dict[str, float] = {}
    try:
        for row in client.query(change_query).result():
            this_week = float(row["this_week"] or 0)
            last_week = float(row["last_week"] or 0)
            if abs(last_week) > 0:
                change_pcts[row["currency"]] = round(
                    (this_week - last_week) / abs(last_week) * 100, 1
                )
            elif this_week != 0:
                change_pcts[row["currency"]] = round(this_week / 1000, 1)
    except Exception:
        pass

    totals = list(currency_totals.values())
    for t in totals:
        t["changePercent"] = max(-15.0, min(15.0, change_pcts.get(t["currency"], 0)))
    grand_total = sum(t["usdEquivalent"] for t in totals)
    return {
        "balances": balances,
        "currencyTotals": totals,
        "grandTotalUsd": round(grand_total, 2),
    }


# ---- Forecast ----

@app.get("/api/forecast")
def forecast(days: int = Query(default=30)):
    client = bigquery.Client(project=PROJECT_ID)
    cash_journal_subquery = f"""SELECT posting_date, currency,
               SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
        FROM `{PROJECT_ID}.{DATASET_ID}.cash_journal`
        GROUP BY posting_date, currency"""
    query = f"""
        SELECT
            forecast_timestamp AS forecast_date,
            forecast_value AS net_cash_flow,
            confidence_level,
            prediction_interval_lower_bound AS lower_bound,
            prediction_interval_upper_bound AS upper_bound,
            currency
        FROM AI.FORECAST(
            ({cash_journal_subquery}),
            data_col => 'net_cash_flow',
            timestamp_col => 'posting_date',
            id_cols => ['currency'],
            horizon => {int(days)},
            confidence_level => 0.95
        )
        ORDER BY currency, forecast_timestamp
    """
    try:
        rows = client.query(query).result()
        return {"forecasts": _serialize(rows), "horizon_days": days}
    except Exception as e:
        return {"error": str(e), "forecasts": [], "horizon_days": days}


# ---- AR / AP Items ----

@app.get("/api/ar-items")
def ar_items(currency: str = Query(default="")):
    client = bigquery.Client(project=PROJECT_ID)
    where = "WHERE status = 'OPEN'"
    params = []
    if currency:
        where += " AND currency = @currency"
        params.append(bigquery.ScalarQueryParameter("currency", "STRING", currency))
    query = f"""
        SELECT ar_item_id, customer_id, customer_name, invoice_number,
               amount, currency, due_date, probability, description
        FROM {_table('ar_open_items')} {where}
        ORDER BY due_date
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return {"items": _serialize(rows)}


@app.get("/api/ap-items")
def ap_items(currency: str = Query(default="")):
    client = bigquery.Client(project=PROJECT_ID)
    where = "WHERE status = 'OPEN'"
    params = []
    if currency:
        where += " AND currency = @currency"
        params.append(bigquery.ScalarQueryParameter("currency", "STRING", currency))
    query = f"""
        SELECT ap_item_id, vendor_id, vendor_name, invoice_number,
               amount, currency, due_date, payment_method, description
        FROM {_table('ap_open_items')} {where}
        ORDER BY due_date
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return {"items": _serialize(rows)}


# ---- Payment Runs ----

@app.get("/api/payment-runs")
def payment_runs():
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT payment_run_id, scheduled_date, total_amount, currency,
               item_count, status, description
        FROM {_table('payment_runs')}
        WHERE status = 'SCHEDULED'
        ORDER BY scheduled_date
    """
    rows = client.query(query).result()
    return {"payment_runs": _serialize(rows)}


# ---- Anomalies ----

@app.get("/api/anomalies")
def anomalies():
    client = bigquery.Client(project=PROJECT_ID)
    results = []

    # 1. TimesFM-based anomaly detection on cash journal
    try:
        ai_anomaly_query = f"""
            SELECT *
            FROM AI.DETECT_ANOMALIES(
                (SELECT posting_date, currency,
                        SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
                 FROM {_table('cash_journal')}
                 WHERE posting_date < DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                 GROUP BY posting_date, currency),
                (SELECT posting_date, currency,
                        SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
                 FROM {_table('cash_journal')}
                 WHERE posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                 GROUP BY posting_date, currency),
                data_col => 'net_cash_flow',
                timestamp_col => 'posting_date',
                id_cols => ['currency'],
                anomaly_prob_threshold => 0.95
            )
            WHERE is_anomaly = TRUE
            ORDER BY anomaly_probability DESC
        """
        ai_rows = _serialize(client.query(ai_anomaly_query).result())
        for item in ai_rows:
            ts = item.get("time_series_timestamp", "")
            prob = float(item.get("anomaly_probability", 0))
            results.append({
                "severity": "HIGH" if prob > 0.99 else "MEDIUM",
                "type": "TIMESFM_CASH_FLOW_ANOMALY",
                "description": (
                    f"{item.get('currency', '')} net cash flow of "
                    f"{float(item.get('time_series_data', 0)):,.0f} on {ts} is anomalous "
                    f"(probability {prob:.2%}, expected range "
                    f"{float(item.get('lower_bound', 0)):,.0f} to "
                    f"{float(item.get('upper_bound', 0)):,.0f})"
                ),
                "details": item,
            })
    except Exception:
        pass  # TimesFM anomaly detection unavailable, continue with rule-based checks

    # 2. Low-probability receivables
    risky_ar_query = f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN' AND probability < 0.6
        ORDER BY amount DESC
    """
    risky_ar = _serialize(client.query(risky_ar_query).result())
    for item in risky_ar:
        results.append({
            "severity": "HIGH" if item["amount"] > 1000000 else "MEDIUM",
            "type": "LOW_PROBABILITY_RECEIVABLE",
            "description": (
                f"{item['customer_name']}: {item['currency']} "
                f"{item['amount']:,.0f} due {item['due_date']} "
                f"with only {float(item['probability'])*100:.0f}% probability"
            ),
            "details": item,
        })

    # 3. AP concentration anomalies
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
        ap_rows = _serialize(client.query(ap_concentration_query).result())
        for item in ap_rows:
            results.append({
                "severity": "MEDIUM",
                "type": "AP_CONCENTRATION",
                "description": (
                    f"Week of {item['week_start']}: {item['currency']} "
                    f"{float(item['weekly_total']):,.0f} in AP payments "
                    f"({float(item['z_score']):.1f} std devs above average)"
                ),
                "details": item,
            })
    except Exception:
        pass

    results.sort(key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}.get(x["severity"], 2))

    return {"anomalies": results, "count": len(results)}


@app.get("/api/anomaly-explanations")
def anomaly_explanations():
    """Fetch Gemini-powered explanations for current anomalies (cached 5 min)."""
    # First get the current anomalies
    anomalies_resp = anomalies()
    results = anomalies_resp["anomalies"]

    if not results:
        return {"explanations": []}

    try:
        cache_key = hashlib.md5(
            json.dumps([r["description"] for r in results]).encode()
        ).hexdigest()
        now = time.time()
        cached = _explanation_cache.get(cache_key)
        if cached and (now - cached[0]) < _CACHE_TTL:
            return {"explanations": cached[1]}

        anomaly_summaries = [
            {"type": r["type"], "description": r["description"]}
            for r in results
        ]
        prompt = f"""You are a treasury analyst. For each anomaly below, provide:
1. "explanation": A 1-2 sentence business-context explanation of why this matters
2. "suggested_action": A specific recommended action

ANOMALIES:
{json.dumps(anomaly_summaries, indent=2)}

Return a JSON array in the same order as input. Return ONLY the JSON array, no other text."""
        vertexai.init(project=PROJECT_ID, location=REGION)
        model = GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        resp_text = response.text.strip()
        if resp_text.startswith("```"):
            resp_text = resp_text.split("\n", 1)[1]
            resp_text = resp_text.rsplit("```", 1)[0]
        explanations = json.loads(resp_text)
        _explanation_cache[cache_key] = (now, explanations)
        return {"explanations": explanations}
    except Exception as e:
        logger.warning(f"Gemini explanation enrichment failed: {e}")
        return {"explanations": []}


# ---- Audit Log ----

@app.get("/api/audit-log")
def audit_log(limit: int = Query(default=50)):
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT timestamp, agent_name, action, tool_name,
               input_summary, output_summary
        FROM {_table('agent_audit_log')}
        ORDER BY timestamp DESC
        LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("limit", "INT64", limit)]
    )
    rows = client.query(query, job_config=job_config).result()
    return {"entries": _serialize(rows)}


# ---- Approvals ----

@app.get("/api/approvals")
def approvals(status: str = Query(default="")):
    client = bigquery.Client(project=PROJECT_ID)
    where = ""
    params = []
    if status:
        where = "WHERE status = @status"
        params.append(bigquery.ScalarQueryParameter("status", "STRING", status))
    query = f"""
        SELECT request_id, action_type, amount, currency, status,
               description, agent_reasoning, requested_at,
               approved_at, approved_by, rejection_reason
        FROM `{PROJECT_ID}.{DATASET_ID}.approval_requests`
        {where}
        ORDER BY requested_at DESC
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return {"approvals": _serialize(rows)}


@app.post("/api/approvals/{request_id}/approve")
def approve_request(
    request_id: str,
    approved_by: str = Query(default="VP Treasury (UI)"),
    body: dict | None = Body(default=None),
):
    try:
        client = bigquery.Client(project=PROJECT_ID)
        now = datetime.datetime.now().isoformat()

        # Build SET clause with optional overrides
        set_parts = [
            "status = 'APPROVED'",
            "approved_by = @approved_by",
            "approved_at = @approved_at",
        ]
        params = [
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            bigquery.ScalarQueryParameter("approved_by", "STRING", approved_by),
            bigquery.ScalarQueryParameter("approved_at", "STRING", now),
        ]

        overrides = body or {}
        if "action_type" in overrides:
            set_parts.append("action_type = @action_type")
            params.append(bigquery.ScalarQueryParameter("action_type", "STRING", overrides["action_type"]))
        if "amount" in overrides:
            set_parts.append("amount = @amount")
            params.append(bigquery.ScalarQueryParameter("amount", "FLOAT64", float(overrides["amount"])))
        if "currency" in overrides:
            set_parts.append("currency = @currency")
            params.append(bigquery.ScalarQueryParameter("currency", "STRING", overrides["currency"]))
        if "description" in overrides:
            set_parts.append("description = @description")
            params.append(bigquery.ScalarQueryParameter("description", "STRING", overrides["description"]))

        query = f"""
            UPDATE `{PROJECT_ID}.{DATASET_ID}.approval_requests`
            SET {', '.join(set_parts)}
            WHERE request_id = @request_id AND status = 'PENDING'
        """
        job_config = bigquery.QueryJobConfig(query_parameters=params)
        client.query(query, job_config=job_config).result()
    except Exception as e:
        logger.error(f"Approve failed for {request_id}: {e}")
        return JSONResponse(status_code=500, content={"error": f"Approve failed: {e}"})

    # Execute the approved action using data from approval_requests directly
    exec_result = None
    try:
        lookup_query = f"""
            SELECT action_type, amount, currency, description
            FROM `{PROJECT_ID}.{DATASET_ID}.approval_requests`
            WHERE request_id = @request_id
            LIMIT 1
        """
        lookup_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("request_id", "STRING", request_id)
            ]
        )
        rows = list(client.query(lookup_query, job_config=lookup_config).result())
        if rows:
            rec = dict(rows[0])
            exec_result = _execute_action(
                rec["action_type"], float(rec["amount"]),
                rec["currency"], rec.get("description", "")
            )
            _log_action(
                client, "ExecutionAgent", "EXECUTE",
                rec["action_type"].lower(),
                f"Approved: {rec['currency']} {float(rec['amount']):,.0f}",
                json.dumps(exec_result, default=str),
            )
    except Exception as e:
        logger.warning(f"Post-approval execution failed: {e}")

    return {"status": "approved", "request_id": request_id, "approved_by": approved_by, "execution": exec_result}


@app.post("/api/approvals/{request_id}/reject")
def reject_request(
    request_id: str,
    rejected_by: str = Query(default="VP Treasury (UI)"),
    reason: str = Query(default=""),
):
    try:
        client = bigquery.Client(project=PROJECT_ID)
        now = datetime.datetime.now().isoformat()
        query = f"""
            UPDATE `{PROJECT_ID}.{DATASET_ID}.approval_requests`
            SET status = 'REJECTED',
                approved_by = @rejected_by,
                approved_at = @rejected_at,
                rejection_reason = @reason
            WHERE request_id = @request_id AND status = 'PENDING'
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
                bigquery.ScalarQueryParameter("rejected_by", "STRING", rejected_by),
                bigquery.ScalarQueryParameter("rejected_at", "STRING", now),
                bigquery.ScalarQueryParameter("reason", "STRING", reason),
            ]
        )
        client.query(query, job_config=job_config).result()
    except Exception as e:
        logger.error(f"Reject failed for {request_id}: {e}")
        return JSONResponse(status_code=500, content={"error": f"Reject failed: {e}"})
    return {"status": "rejected", "request_id": request_id, "reason": reason}


# ---- Agent Memory ----

@app.get("/api/memories")
def list_memories():
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT memory_id, created_at, source, category, content,
               related_action_type, related_entity, created_by, is_active
        FROM {_table('agent_memory')}
        WHERE is_active = TRUE
        ORDER BY created_at DESC
    """
    rows = client.query(query).result()
    return {"memories": _serialize(rows)}


@app.post("/api/memories")
def create_memory(body: dict = Body(...)):
    try:
        client = bigquery.Client(project=PROJECT_ID)
        memory_id = f"MEM-{random.randint(100000, 999999)}"
        now = datetime.datetime.now().isoformat()
        query = f"""
            INSERT INTO {_table('agent_memory')}
            (memory_id, created_at, source, category, content,
             related_action_type, related_entity, created_by, is_active)
            VALUES
            (@memory_id, @created_at, @source, @category, @content,
             @related_action_type, @related_entity, @created_by, TRUE)
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("memory_id", "STRING", memory_id),
                bigquery.ScalarQueryParameter("created_at", "STRING", now),
                bigquery.ScalarQueryParameter("source", "STRING", body.get("source", "MANUAL")),
                bigquery.ScalarQueryParameter("category", "STRING", body.get("category", "PREFERENCE")),
                bigquery.ScalarQueryParameter("content", "STRING", body.get("content", "")),
                bigquery.ScalarQueryParameter("related_action_type", "STRING", body.get("related_action_type")),
                bigquery.ScalarQueryParameter("related_entity", "STRING", body.get("related_entity")),
                bigquery.ScalarQueryParameter("created_by", "STRING", body.get("created_by", "VP Treasury (UI)")),
            ]
        )
        client.query(query, job_config=job_config).result()
    except Exception as e:
        logger.error(f"Create memory failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Create memory failed: {e}"})
    return {"status": "created", "memory_id": memory_id}


@app.post("/api/memories/{memory_id}/deactivate")
def deactivate_memory(memory_id: str):
    try:
        client = bigquery.Client(project=PROJECT_ID)
        query = f"""
            UPDATE {_table('agent_memory')}
            SET is_active = FALSE
            WHERE memory_id = @memory_id
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("memory_id", "STRING", memory_id),
            ]
        )
        client.query(query, job_config=job_config).result()
    except Exception as e:
        logger.error(f"Deactivate memory failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Deactivate memory failed: {e}"})
    return {"status": "deactivated", "memory_id": memory_id}


# ---- Execution Helpers ----

def _execute_action(action_type: str, amount: float, currency: str, description: str) -> dict:
    """Call mock bank/broker API to execute a financial action."""
    try:
        if action_type == "PLACE_DEPOSIT":
            data = json.dumps({
                "bank_name": "Deutsche Bank",
                "currency": currency,
                "amount": amount,
                "term_days": 30,
                "rate_pct": 4.2,
            }).encode()
            req = urllib.request.Request(
                f"{BANK_API_URL}/deposits",
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        elif action_type == "HEDGE_FX":
            data = json.dumps({
                "buy_currency": "USD",
                "sell_currency": currency,
                "buy_amount": amount,
                "trade_type": "forward",
                "settlement_days": 21,
            }).encode()
            req = urllib.request.Request(
                f"{BROKER_API_URL}/fx-trades",
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        else:
            return {
                "status": "noted",
                "action": action_type,
                "confirmation_id": f"ACT-{random.randint(100000, 999999)}",
                "description": description,
            }
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        return {"status": "error", "error": str(e)}


def _log_action(client, agent_name: str, action: str, tool_name: str,
                input_summary: str, output_summary: str):
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.agent_audit_log"
    errors = client.insert_rows_json(table_ref, [{
        "agent_name": agent_name,
        "action": action,
        "tool_name": tool_name,
        "input_summary": input_summary,
        "output_summary": output_summary,
    }])
    if errors:
        logger.error(f"Failed to insert audit log rows: {errors}")


# ---- FX Rates ----

@app.get("/api/fx-rates")
def fx_rates():
    client = bigquery.Client(project=PROJECT_ID)
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
    return {"rates": _serialize(rows)}


# ---- Recommendations ----

@app.get("/api/recommendations")
def recommendations():
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT recommendation_id, created_at, priority, action_type,
               amount, currency, description, rationale, status,
               approval_request_id, source_anomaly_type, source_anomaly_description
        FROM {_table('agent_recommendations')}
        ORDER BY
            CASE priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
            created_at DESC
    """
    rows = client.query(query).result()
    return {"recommendations": _serialize(rows)}


@app.post("/api/recommendations/{recommendation_id}/dismiss")
def dismiss_recommendation(recommendation_id: str):
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        UPDATE {_table('agent_recommendations')}
        SET status = 'DISMISSED'
        WHERE recommendation_id = @rec_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("rec_id", "STRING", recommendation_id)
        ]
    )
    client.query(query, job_config=job_config).result()
    return {"status": "dismissed", "recommendation_id": recommendation_id}


# ---- Executions ----

@app.get("/api/executions")
def executions(limit: int = Query(default=50)):
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT timestamp, agent_name, tool_name, input_summary, output_summary
        FROM {_table('agent_audit_log')}
        WHERE action = 'EXECUTE'
        ORDER BY timestamp DESC
        LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("limit", "INT64", limit)]
    )
    rows = client.query(query, job_config=job_config).result()
    entries = []
    for row in rows:
        entry = dict(row)
        for k, v in entry.items():
            if isinstance(v, (datetime.date, datetime.datetime)):
                entry[k] = v.isoformat()
        # Parse output_summary as JSON for structured details
        try:
            entry["details"] = json.loads(entry.get("output_summary", "{}"))
        except (json.JSONDecodeError, TypeError):
            entry["details"] = {}
        entries.append(entry)
    return {"executions": entries}


# ---- Run Agent Review ----

@app.post("/api/run-review")
def run_review():
    """Proxy to agent-runner's daily review."""
    try:
        req = urllib.request.Request(
            f"{AGENT_RUNNER_URL}/run/daily-review",
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        return {"error": f"Agent runner unavailable: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}


# ---- Reset Demo ----

@app.post("/api/reset-demo")
def reset_demo(full: bool = Query(default=False)):
    client = bigquery.Client(project=PROJECT_ID)
    results = {"status": "ok", "tables_truncated": [], "errors": []}

    # Always truncate operational tables
    operational_tables = ["approval_requests", "agent_audit_log", "agent_recommendations", "agent_memory"]
    for table_name in operational_tables:
        try:
            client.query(
                f"TRUNCATE TABLE `{PROJECT_ID}.{DATASET_ID}.{table_name}`"
            ).result()
            results["tables_truncated"].append(table_name)
        except Exception as e:
            results["errors"].append(f"{table_name}: {str(e)}")

    # Insert seed memories
    try:
        seed_memories_sql = f"""
            INSERT INTO {_table('agent_memory')}
            (memory_id, created_at, source, category, content, related_action_type, related_entity, created_by, is_active)
            VALUES
            ('MEM-SEED-001', CURRENT_TIMESTAMP(), 'MANUAL', 'PREFERENCE',
             'Prefer Deutsche Bank over BNP Paribas for EUR term deposits — our relationship manager offers 15-25bps above market.',
             'PLACE_DEPOSIT', 'Deutsche Bank', 'VP Treasury (Sarah Chen)', TRUE),
            ('MEM-SEED-002', CURRENT_TIMESTAMP(), 'MANUAL', 'POLICY_OVERRIDE',
             'For GBP FX hedges, use 30-day settlement (not 21-day) to align with month-end reporting. CFO approved this deviation Q4 2025.',
             'HEDGE_FX', 'GBP', 'VP Treasury (Sarah Chen)', TRUE)
        """
        client.query(seed_memories_sql).result()
    except Exception as e:
        results["errors"].append(f"agent_memory seed: {str(e)}")

    if full:
        # Full reset: call agent-runner service to regenerate seed data
        refresh_url = f"{AGENT_RUNNER_URL}/run/refresh-data"

        try:
            req = urllib.request.Request(refresh_url, method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=300) as resp:
                refresh_result = json.loads(resp.read().decode())
                results["refresh"] = refresh_result
        except urllib.error.URLError as e:
            results["errors"].append(f"Full reset (agent-runner call): {str(e)}")
        except Exception as e:
            results["errors"].append(f"Full reset: {str(e)}")

    return results
