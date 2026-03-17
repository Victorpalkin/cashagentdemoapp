"""FX rate lookup and currency conversion tools."""

from google.cloud import bigquery

from ..shared_libraries.constants import PROJECT_ID, DATASET_ID


def get_fx_rates(base_currency: str = "USD") -> dict:
    """Returns current FX rates for the given base currency.

    Args:
        base_currency: Base currency code (default "USD").

    Returns:
        dict with exchange rates to/from the base currency.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT from_currency, to_currency, exchange_rate, rate_date
        FROM `{PROJECT_ID}.{DATASET_ID}.fx_rates`
        WHERE rate_date = CURRENT_DATE()
          AND (from_currency = @base OR to_currency = @base)
        ORDER BY from_currency, to_currency
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("base", "STRING", base_currency)
        ]
    )
    rows = client.query(query, job_config=job_config).result()
    return {"rates": [dict(row) for row in rows]}


def convert_currency(
    amount: float, from_currency: str, to_currency: str
) -> dict:
    """Converts an amount between currencies using today's FX rate.

    Args:
        amount: The amount to convert.
        from_currency: Source currency code (e.g. "EUR").
        to_currency: Target currency code (e.g. "USD").

    Returns:
        dict with converted amount and rate used.
    """
    if from_currency == to_currency:
        return {
            "original_amount": amount,
            "converted_amount": amount,
            "rate": 1.0,
            "from_currency": from_currency,
            "to_currency": to_currency,
        }

    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT exchange_rate
        FROM `{PROJECT_ID}.{DATASET_ID}.fx_rates`
        WHERE rate_date = CURRENT_DATE()
          AND from_currency = @from_curr
          AND to_currency = @to_curr
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("from_curr", "STRING", from_currency),
            bigquery.ScalarQueryParameter("to_curr", "STRING", to_currency),
        ]
    )
    rows = list(client.query(query, job_config=job_config).result())
    if rows:
        rate = rows[0]["exchange_rate"]
    else:
        # Try reverse lookup
        query_rev = f"""
            SELECT exchange_rate
            FROM `{PROJECT_ID}.{DATASET_ID}.fx_rates`
            WHERE rate_date = CURRENT_DATE()
              AND from_currency = @to_curr
              AND to_currency = @from_curr
        """
        job_config_rev = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("to_curr", "STRING", to_currency),
                bigquery.ScalarQueryParameter("from_curr", "STRING", from_currency),
            ]
        )
        rows_rev = list(client.query(query_rev, job_config=job_config_rev).result())
        if rows_rev:
            rate = 1.0 / rows_rev[0]["exchange_rate"]
        else:
            return {"error": f"No FX rate found for {from_currency}/{to_currency}"}

    converted = round(amount * rate, 2)
    return {
        "original_amount": amount,
        "converted_amount": converted,
        "rate": rate,
        "from_currency": from_currency,
        "to_currency": to_currency,
    }
