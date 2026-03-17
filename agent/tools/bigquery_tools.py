"""BigQuery tools for querying cash management data."""

from google.cloud import bigquery

from ..shared_libraries.constants import PROJECT_ID, DATASET_ID


def _table(name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET_ID}.{name}`"


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
        entry = dict(row)
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
        entry = dict(row)
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
    items = [dict(row) for row in rows]
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
    items = [dict(row) for row in rows]
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
    return {"payment_runs": [dict(row) for row in rows]}


def get_forecast(horizon_days: int = 30) -> dict:
    """Returns BQML ARIMA+ cash flow forecast by currency.

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
            standard_error,
            confidence_level,
            prediction_interval_lower_bound AS lower_bound,
            prediction_interval_upper_bound AS upper_bound,
            currency
        FROM ML.FORECAST(
            MODEL `{PROJECT_ID}.{DATASET_ID}.cash_forecast_model`,
            STRUCT({horizon_days} AS horizon, 0.95 AS confidence_level)
        )
        ORDER BY currency, forecast_timestamp
    """
    try:
        rows = client.query(query).result()
        forecasts = [dict(row) for row in rows]
        return {"forecasts": forecasts, "horizon_days": horizon_days}
    except Exception as e:
        return {
            "error": f"Forecast model not available: {str(e)}",
            "suggestion": "Run the BQML model creation notebook first.",
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
    return {"transactions": [dict(row) for row in rows]}


def detect_anomalies() -> dict:
    """Analyzes cash journal and AR/AP data for anomalies and risks.

    Returns:
        dict with detected anomalies ranked by severity.
    """
    client = bigquery.Client(project=PROJECT_ID)

    # Check AR items with low probability
    risky_ar_query = f"""
        SELECT customer_name, amount, currency, due_date, probability
        FROM {_table('ar_open_items')}
        WHERE status = 'OPEN' AND probability < 0.6
        ORDER BY amount DESC
    """
    risky_ar = [dict(r) for r in client.query(risky_ar_query).result()]

    # Check for unusual weekly AP concentration
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

    # Check for late-paying customers (from history)
    late_payers_query = f"""
        SELECT
            counterparty,
            currency,
            COUNT(*) AS payment_count,
            AVG(amount) AS avg_amount
        FROM {_table('cash_journal')}
        WHERE transaction_type = 'INFLOW'
            AND posting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
        GROUP BY counterparty, currency
        HAVING COUNT(*) >= 3
        ORDER BY avg_amount DESC
        LIMIT 10
    """
    frequent_payers = [dict(r) for r in client.query(late_payers_query).result()]

    anomalies = []

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
    return {"entries": [dict(row) for row in rows]}
