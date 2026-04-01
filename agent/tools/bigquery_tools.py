"""BigQuery tools for querying cash management data."""

import datetime

from google.cloud import bigquery

from ..shared_libraries.constants import PROJECT_ID, DATASET_ID
from .policy_tools import get_collection_risk_threshold, get_hedge_thresholds


def _table(name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET_ID}.{name}`"


def _row_to_dict(row) -> dict:
    """Convert a BigQuery Row to a JSON-serializable dict."""
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, (datetime.date, datetime.datetime)):
            d[k] = v.isoformat()
    return d


def get_cash_position(company_code: str = "1000") -> dict:
    """Returns current cash position across all bank accounts for a company.

    Args:
        company_code: SAP company code (default "1000").

    Returns:
        dict with balances by bank account including currency and USD equivalent.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT
            b.bank_account_id,
            b.bank_name,
            b.account_type,
            b.currency,
            b.current_balance,
            b.last_updated,
            fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        JOIN {_table('gl_accounts')} g ON b.gl_account = g.gl_account
        LEFT JOIN {_table('fx_rates')} fx
            ON fx.from_currency = b.currency
            AND fx.to_currency = 'USD'
            AND fx.rate_date = CURRENT_DATE()
        WHERE g.company_code = @company_code
        ORDER BY b.currency, b.bank_name
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("company_code", "STRING", company_code)
        ]
    )
    rows = client.query(query, job_config=job_config).result()
    balances = []
    for row in rows:
        entry = _row_to_dict(row)
        if entry["currency"] == "USD":
            entry["usd_equivalent"] = entry["current_balance"]
        elif entry["usd_rate"]:
            entry["usd_equivalent"] = round(
                entry["current_balance"] * entry["usd_rate"], 2
            )
        balances.append(entry)
    return {"balances": balances}


def get_bank_balances() -> dict:
    """Returns summary of bank balances grouped by currency.

    Returns:
        dict with currency totals and grand total in USD.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT
            b.currency,
            SUM(b.current_balance) AS total_balance,
            fx.exchange_rate AS usd_rate
        FROM {_table('bank_accounts')} b
        LEFT JOIN {_table('fx_rates')} fx
            ON fx.from_currency = b.currency
            AND fx.to_currency = 'USD'
            AND fx.rate_date = CURRENT_DATE()
        GROUP BY b.currency, fx.exchange_rate
        ORDER BY b.currency
    """
    rows = client.query(query).result()
    currency_totals = []
    grand_total_usd = 0
    for row in rows:
        entry = _row_to_dict(row)
        if entry["currency"] == "USD":
            entry["usd_equivalent"] = entry["total_balance"]
        elif entry["usd_rate"]:
            entry["usd_equivalent"] = round(
                entry["total_balance"] * entry["usd_rate"], 2
            )
        grand_total_usd += entry.get("usd_equivalent", 0)
        currency_totals.append(entry)
    return {
        "currency_totals": currency_totals,
        "grand_total_usd": round(grand_total_usd, 2),
    }


def get_ar_open_items(currency: str = "") -> dict:
    """Returns open accounts receivable items (expected inflows).

    Args:
        currency: Filter by currency (e.g. "USD", "EUR", "GBP"). Empty for all.

    Returns:
        dict with list of AR items and summary totals.
    """
    client = bigquery.Client(project=PROJECT_ID)
    where = "WHERE status = 'OPEN'"
    params = []
    if currency:
        where += " AND currency = @currency"
        params.append(
            bigquery.ScalarQueryParameter("currency", "STRING", currency)
        )
    query = f"""
        SELECT ar_item_id, customer_id, customer_name, invoice_number,
               amount, currency, due_date, probability, description
        FROM {_table('ar_open_items')}
        {where}
        ORDER BY due_date
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    items = [_row_to_dict(row) for row in rows]
    return {"items": items, "count": len(items)}


def get_ap_open_items(currency: str = "") -> dict:
    """Returns open accounts payable items (expected outflows).

    Args:
        currency: Filter by currency (e.g. "USD", "EUR", "GBP"). Empty for all.

    Returns:
        dict with list of AP items and summary totals.
    """
    client = bigquery.Client(project=PROJECT_ID)
    where = "WHERE status = 'OPEN'"
    params = []
    if currency:
        where += " AND currency = @currency"
        params.append(
            bigquery.ScalarQueryParameter("currency", "STRING", currency)
        )
    query = f"""
        SELECT ap_item_id, vendor_id, vendor_name, invoice_number,
               amount, currency, due_date, payment_method, description
        FROM {_table('ap_open_items')}
        {where}
        ORDER BY due_date
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    items = [_row_to_dict(row) for row in rows]
    return {"items": items, "count": len(items)}


def get_payment_runs() -> dict:
    """Returns scheduled payment runs for the next 30 days.

    Returns:
        dict with list of upcoming payment runs.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT payment_run_id, scheduled_date, total_amount, currency,
               item_count, status, description
        FROM {_table('payment_runs')}
        WHERE status = 'SCHEDULED'
        ORDER BY scheduled_date
    """
    rows = client.query(query).result()
    return {"payment_runs": [_row_to_dict(row) for row in rows]}


def _cash_journal_subquery() -> str:
    """Returns the subquery for daily net cash flow by currency."""
    return f"""SELECT posting_date, currency,
               SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
        FROM `{PROJECT_ID}.{DATASET_ID}.cash_journal`
        GROUP BY posting_date, currency"""


def get_forecast(horizon_days: int = 30) -> dict:
    """Returns TimesFM cash flow forecast by currency using AI.FORECAST.

    Args:
        horizon_days: Number of days to forecast (default 30).

    Returns:
        dict with forecast values by currency and date.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT
            forecast_timestamp AS forecast_date,
            forecast_value AS net_cash_flow,
            confidence_level,
            prediction_interval_lower_bound AS lower_bound,
            prediction_interval_upper_bound AS upper_bound,
            currency
        FROM AI.FORECAST(
            ({_cash_journal_subquery()}),
            data_col => 'net_cash_flow',
            timestamp_col => 'posting_date',
            id_cols => ['currency'],
            horizon => {horizon_days},
            confidence_level => 0.95
        )
        ORDER BY currency, forecast_timestamp
    """
    try:
        rows = client.query(query).result()
        forecasts = [_row_to_dict(row) for row in rows]
        return {"forecasts": forecasts, "horizon_days": horizon_days}
    except Exception as e:
        return {
            "error": f"Forecast not available: {str(e)}",
        }


def get_enriched_forecast(horizon_days: int = 30) -> dict:
    """Returns side-by-side comparison of ML-only vs agent-enriched cash forecast.

    Combines TimesFM statistical forecast with probability-weighted AR items,
    AP obligations, and scheduled payment runs to show how agent intelligence
    improves the raw ML prediction.

    Args:
        horizon_days: Number of days to forecast (default 30).

    Returns:
        dict with ml_forecast, enriched_forecast, key_divergences, and summary.
    """
    client = bigquery.Client(project=PROJECT_ID)
    today = datetime.date.today()

    # 1. Get TimesFM forecast (statistical baseline)
    ml_forecast_query = f"""
        SELECT
            forecast_timestamp AS forecast_date,
            forecast_value AS net_cash_flow,
            currency
        FROM AI.FORECAST(
            ({_cash_journal_subquery()}),
            data_col => 'net_cash_flow',
            timestamp_col => 'posting_date',
            id_cols => ['currency'],
            horizon => {horizon_days},
            confidence_level => 0.95
        )
        ORDER BY currency, forecast_timestamp
    """
    try:
        ml_rows = [dict(r) for r in client.query(ml_forecast_query).result()]
    except Exception:
        ml_rows = []

    # 2. Get current bank balances by currency
    balance_query = f"""
        SELECT currency, SUM(current_balance) AS total_balance
        FROM {_table('bank_accounts')}
        GROUP BY currency
    """
    balances = {r["currency"]: float(r["total_balance"])
                for r in client.query(balance_query).result()}

    # 3. Get AR items with probability weighting
    ar_query = f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN'
        ORDER BY due_date
    """
    ar_items = [dict(r) for r in client.query(ar_query).result()]

    # 4. Get AP items
    ap_query = f"""
        SELECT vendor_name, amount, currency, due_date
        FROM {_table('ap_open_items')}
        WHERE status = 'OPEN'
        ORDER BY due_date
    """
    ap_items = [dict(r) for r in client.query(ap_query).result()]

    # 5. Get scheduled payment runs
    pr_query = f"""
        SELECT total_amount, currency, scheduled_date
        FROM {_table('payment_runs')}
        WHERE status = 'SCHEDULED'
        ORDER BY scheduled_date
    """
    payment_runs = [dict(r) for r in client.query(pr_query).result()]

    # Helper: assign items to weekly buckets
    def week_number(d):
        if hasattr(d, "date"):
            d = d.date()
        delta = (d - today).days
        if delta < 0:
            return 0
        return delta // 7 + 1

    num_weeks = (horizon_days // 7) + 1

    # Aggregate ML forecast by currency and week
    ml_by_ccy_week = {}
    for row in ml_rows:
        ccy = row["currency"]
        wk = week_number(row["forecast_date"])
        if wk < 1 or wk > num_weeks:
            continue
        key = (ccy, wk)
        ml_by_ccy_week[key] = ml_by_ccy_week.get(key, 0) + float(row["net_cash_flow"])

    # Aggregate AR (probability-weighted) by currency and week
    ar_by_ccy_week = {}
    risk_factors = []
    for item in ar_items:
        ccy = item["currency"]
        wk = week_number(item["due_date"])
        if wk < 1 or wk > num_weeks:
            continue
        prob = float(item["probability"])
        amt = float(item["amount"])
        weighted = amt * prob
        key = (ccy, wk)
        ar_by_ccy_week[key] = ar_by_ccy_week.get(key, 0) + weighted
        if prob < 0.7:
            risk_factors.append({
                "customer": item["customer_name"],
                "currency": ccy,
                "amount": amt,
                "probability": prob,
                "weighted_amount": round(weighted, 2),
                "at_risk": round(amt - weighted, 2),
                "week": wk,
                "due_date": str(item["due_date"]),
                "impact": f"BQML doesn't know {item['customer_name']} {ccy} {amt:,.0f} "
                          f"is at {prob*100:.0f}% probability - enriched forecast "
                          f"reduces expected inflow by {amt - weighted:,.0f}",
            })

    # Aggregate AP by currency and week
    ap_by_ccy_week = {}
    for item in ap_items:
        ccy = item["currency"]
        wk = week_number(item["due_date"])
        if wk < 1 or wk > num_weeks:
            continue
        key = (ccy, wk)
        ap_by_ccy_week[key] = ap_by_ccy_week.get(key, 0) + float(item["amount"])

    # Aggregate payment runs by currency and week
    pr_by_ccy_week = {}
    for item in payment_runs:
        ccy = item["currency"]
        wk = week_number(item["scheduled_date"])
        if wk < 1 or wk > num_weeks:
            continue
        key = (ccy, wk)
        pr_by_ccy_week[key] = pr_by_ccy_week.get(key, 0) + float(item["total_amount"])

    # Build week-by-week comparison per currency
    currencies = sorted(set(
        [r["currency"] for r in ml_rows]
        + [i["currency"] for i in ar_items]
        + [i["currency"] for i in ap_items]
        + list(balances.keys())
    ))

    ml_forecast_result = []
    enriched_forecast_result = []
    key_divergences = []

    for ccy in currencies:
        ml_running = balances.get(ccy, 0)
        enriched_running = balances.get(ccy, 0)

        for wk in range(1, num_weeks + 1):
            key = (ccy, wk)
            ml_net = ml_by_ccy_week.get(key, 0)
            ar_in = ar_by_ccy_week.get(key, 0)
            ap_out = ap_by_ccy_week.get(key, 0)
            pr_out = pr_by_ccy_week.get(key, 0)
            enriched_net = ar_in - ap_out - pr_out

            ml_running += ml_net
            enriched_running += enriched_net

            ml_entry = {
                "currency": ccy,
                "week": wk,
                "ml_net_flow": round(ml_net, 2),
                "ml_cumulative_balance": round(ml_running, 2),
            }
            enriched_entry = {
                "currency": ccy,
                "week": wk,
                "ar_inflows_weighted": round(ar_in, 2),
                "ap_outflows": round(ap_out, 2),
                "payment_runs": round(pr_out, 2),
                "enriched_net_flow": round(enriched_net, 2),
                "enriched_cumulative_balance": round(enriched_running, 2),
            }

            ml_forecast_result.append(ml_entry)
            enriched_forecast_result.append(enriched_entry)

            delta = round(enriched_net - ml_net, 2)
            if abs(delta) > 100000:
                key_divergences.append({
                    "currency": ccy,
                    "week": wk,
                    "ml_net_flow": round(ml_net, 2),
                    "enriched_net_flow": round(enriched_net, 2),
                    "delta": delta,
                    "enriched_balance": round(enriched_running, 2),
                    "ml_balance": round(ml_running, 2),
                })

    has_ml = len(ml_rows) > 0
    summary_parts = []
    if not has_ml:
        summary_parts.append(
            "BQML model unavailable - enriched forecast based on AR/AP data only."
        )
    summary_parts.append(
        f"Compared ML-only vs agent-enriched forecast for {len(currencies)} "
        f"currencies over {num_weeks} weeks."
    )
    if risk_factors:
        summary_parts.append(
            f"Found {len(risk_factors)} low-probability receivables that the "
            f"ML model cannot account for."
        )
    if key_divergences:
        summary_parts.append(
            f"Identified {len(key_divergences)} significant divergences "
            f"(>100K) between ML and enriched forecasts."
        )

    return {
        "ml_forecast": ml_forecast_result,
        "enriched_forecast": enriched_forecast_result,
        "key_divergences": key_divergences,
        "risk_factors": risk_factors,
        "current_balances": balances,
        "summary": " ".join(summary_parts),
    }


def get_recent_executions(limit: int = 10) -> dict:
    """Returns recent agent execution actions (trades, deposits, transfers).

    Provides a concise summary of what the agent has recently done,
    filtered to execution and recommendation actions.

    Args:
        limit: Maximum number of entries to return (default 10).

    Returns:
        dict with recent execution entries.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT timestamp, agent_name, action, tool_name,
               input_summary, output_summary
        FROM {_table('agent_audit_log')}
        WHERE action IN ('EXECUTE', 'RECOMMEND', 'APPROVE')
        ORDER BY timestamp DESC
        LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("limit", "INT64", limit)]
    )
    rows = client.query(query, job_config=job_config).result()
    entries = [_row_to_dict(row) for row in rows]
    return {
        "executions": entries,
        "count": len(entries),
        "summary": (
            f"{len(entries)} recent execution/recommendation actions found."
            if entries
            else "No recent executions found."
        ),
    }


def get_transaction_history(
    days: int = 90, currency: str = ""
) -> dict:
    """Returns historical cash journal transactions.

    Args:
        days: Number of days of history to retrieve (default 90).
        currency: Filter by currency. Empty for all.

    Returns:
        dict with transaction history.
    """
    client = bigquery.Client(project=PROJECT_ID)
    where = "WHERE posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)"
    params = [bigquery.ScalarQueryParameter("days", "INT64", days)]
    if currency:
        where += " AND currency = @currency"
        params.append(
            bigquery.ScalarQueryParameter("currency", "STRING", currency)
        )
    query = f"""
        SELECT posting_date, amount, currency, transaction_type,
               counterparty, description
        FROM {_table('cash_journal')}
        {where}
        ORDER BY posting_date DESC
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return {"transactions": [_row_to_dict(row) for row in rows]}


def detect_anomalies() -> dict:
    """Analyzes cash flow for anomalies using TimesFM AI.DETECT_ANOMALIES and business rules.

    Returns:
        dict with detected anomalies ranked by severity.
    """
    client = bigquery.Client(project=PROJECT_ID)
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
        pass  # TimesFM anomaly detection unavailable, continue with rule-based checks

    # 2. Check AR items with low probability
    risky_ar_query = f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN' AND probability < {get_collection_risk_threshold()}
        ORDER BY amount DESC
    """
    risky_ar = [dict(r) for r in client.query(risky_ar_query).result()]

    # 3. Check for unusual weekly AP concentration
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
    ap_anomalies = [dict(r) for r in client.query(ap_concentration_query).result()]

    for item in risky_ar:
        anomalies.append({
            "severity": "HIGH" if item["amount"] > 1000000 else "MEDIUM",
            "type": "LOW_PROBABILITY_RECEIVABLE",
            "description": (
                f"{item['customer_name']}: {item['currency']} "
                f"{item['amount']:,.0f} due {item['due_date']} "
                f"with only {item['probability']*100:.0f}% probability"
            ),
            "details": item,
        })

    for item in ap_anomalies:
        anomalies.append({
            "severity": "MEDIUM",
            "type": "AP_CONCENTRATION",
            "description": (
                f"Week of {item['week_start']}: {item['currency']} "
                f"{item['weekly_total']:,.0f} in AP payments "
                f"({item['z_score']:.1f} std devs above average)"
            ),
            "details": item,
        })

    # 4. FX exposure breach — net foreign currency obligation exceeds hedging threshold
    hedge_thresholds = get_hedge_thresholds()
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

        for cur, threshold in hedge_thresholds.items():
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
                "details": _row_to_dict(r),
            })
    except Exception:
        pass

    anomalies.sort(key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["severity"]])
    return {"anomalies": anomalies, "count": len(anomalies)}


def log_agent_action(
    agent_name: str,
    action: str,
    tool_name: str,
    input_summary: str,
    output_summary: str,
) -> dict:
    """Logs an agent action to the audit trail.

    Args:
        agent_name: Name of the agent performing the action.
        action: Action type (QUERY, ANALYZE, RECOMMEND, EXECUTE, APPROVE, SIMULATE).
        tool_name: Name of the tool called.
        input_summary: Summary of input parameters.
        output_summary: Summary of output/result.

    Returns:
        dict confirming the log entry was created.
    """
    client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.agent_audit_log"
    rows = [
        {
            "agent_name": agent_name,
            "action": action,
            "tool_name": tool_name,
            "input_summary": input_summary,
            "output_summary": output_summary,
        }
    ]
    errors = client.insert_rows_json(table_ref, rows)
    if errors:
        return {"status": "error", "errors": errors}
    return {"status": "logged", "agent_name": agent_name, "action": action}


def get_audit_log(limit: int = 50) -> dict:
    """Returns recent entries from the agent audit log.

    Args:
        limit: Maximum number of entries to return (default 50).

    Returns:
        dict with audit log entries.
    """
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
    return {"entries": [_row_to_dict(row) for row in rows]}
