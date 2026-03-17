from google.adk.agents import Agent

from ...shared_libraries.constants import MODEL
from ...tools.bigquery_tools import (
    get_forecast,
    get_ar_open_items,
    get_ap_open_items,
    get_cash_position,
)
from ...tools.fx_tools import get_fx_rates, convert_currency


def simulate_scenario(
    scenario_description: str,
    remove_ar_customer: str = "",
    fx_change_pct: float = 0.0,
    fx_currency_pair: str = "",
    additional_outflow: float = 0.0,
    additional_outflow_currency: str = "USD",
) -> dict:
    """Simulates a what-if scenario by modifying forecast assumptions.

    Args:
        scenario_description: Natural language description of the scenario.
        remove_ar_customer: Customer name whose AR to remove from inflows (e.g. "ACME Corp").
        fx_change_pct: FX rate change in percent (e.g. -5.0 for 5% weakening).
        fx_currency_pair: Currency pair affected (e.g. "EUR/USD").
        additional_outflow: Extra outflow amount to add.
        additional_outflow_currency: Currency of additional outflow.

    Returns:
        dict with base case vs scenario comparison.
    """
    from google.cloud import bigquery
    from ...shared_libraries.constants import PROJECT_ID, DATASET_ID

    client = bigquery.Client(project=PROJECT_ID)

    # Get current position
    pos_query = f"""
        SELECT currency, SUM(current_balance) AS total
        FROM `{PROJECT_ID}.{DATASET_ID}.bank_accounts`
        GROUP BY currency
    """
    position = {row["currency"]: row["total"] for row in client.query(pos_query).result()}

    # Get AR totals by currency
    ar_query = f"""
        SELECT currency,
               SUM(amount * probability) AS expected_inflow,
               SUM(CASE WHEN customer_name = @customer THEN amount * probability ELSE 0 END) AS customer_inflow
        FROM `{PROJECT_ID}.{DATASET_ID}.ar_open_items`
        WHERE status = 'OPEN'
        GROUP BY currency
    """
    ar_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("customer", "STRING", remove_ar_customer or "")
        ]
    )
    ar_data = {row["currency"]: dict(row) for row in client.query(ar_query, job_config=ar_config).result()}

    # Get AP totals by currency
    ap_query = f"""
        SELECT currency, SUM(amount) AS total_outflow
        FROM `{PROJECT_ID}.{DATASET_ID}.ap_open_items`
        WHERE status = 'OPEN'
        GROUP BY currency
    """
    ap_data = {row["currency"]: row["total_outflow"] for row in client.query(ap_query).result()}

    # Get FX rates
    fx_query = f"""
        SELECT from_currency, to_currency, exchange_rate
        FROM `{PROJECT_ID}.{DATASET_ID}.fx_rates`
        WHERE rate_date = CURRENT_DATE()
    """
    fx_rates = {}
    for row in client.query(fx_query).result():
        fx_rates[f"{row['from_currency']}/{row['to_currency']}"] = row["exchange_rate"]

    # Calculate base case
    base_case = {}
    scenario_case = {}
    for ccy in ["USD", "EUR", "GBP"]:
        inflow = ar_data.get(ccy, {}).get("expected_inflow", 0) or 0
        outflow = ap_data.get(ccy, 0) or 0
        bal = position.get(ccy, 0) or 0
        base_case[ccy] = round(bal + inflow - outflow, 2)

        # Apply scenario modifications
        scenario_inflow = inflow
        if remove_ar_customer and ccy in ar_data:
            scenario_inflow -= ar_data[ccy].get("customer_inflow", 0)

        scenario_outflow = outflow
        if additional_outflow_currency == ccy:
            scenario_outflow += additional_outflow

        scenario_case[ccy] = round(bal + scenario_inflow - scenario_outflow, 2)

    # Apply FX changes for USD equivalent calculation
    base_fx = dict(fx_rates)
    scenario_fx = dict(fx_rates)
    if fx_change_pct and fx_currency_pair:
        if fx_currency_pair in scenario_fx:
            scenario_fx[fx_currency_pair] *= (1 + fx_change_pct / 100)

    def to_usd(amounts, rates):
        total = amounts.get("USD", 0)
        eur_rate = rates.get("EUR/USD", 1.08)
        gbp_rate = rates.get("GBP/USD", 1.27)
        total += amounts.get("EUR", 0) * eur_rate
        total += amounts.get("GBP", 0) * gbp_rate
        return round(total, 2)

    base_usd = to_usd(base_case, base_fx)
    scenario_usd = to_usd(scenario_case, scenario_fx)

    return {
        "scenario": scenario_description,
        "assumptions": {
            "remove_ar_customer": remove_ar_customer or None,
            "fx_change": f"{fx_change_pct}% on {fx_currency_pair}" if fx_change_pct else None,
            "additional_outflow": f"{additional_outflow_currency} {additional_outflow}" if additional_outflow else None,
        },
        "base_case": base_case,
        "scenario_case": scenario_case,
        "base_case_usd_total": base_usd,
        "scenario_case_usd_total": scenario_usd,
        "delta_usd": round(scenario_usd - base_usd, 2),
        "by_currency_delta": {
            ccy: round(scenario_case[ccy] - base_case[ccy], 2)
            for ccy in ["USD", "EUR", "GBP"]
        },
    }


scenario_simulation_agent = Agent(
    name="ScenarioSimulationAgent",
    model=MODEL,
    description="Runs what-if scenario analysis on cash flow forecasts.",
    instruction="""You perform what-if scenario analysis by modifying forecast assumptions.

When the user describes a scenario (e.g. "What if ACME doesn't pay and EUR drops 5%?"),
extract the parameters and call simulate_scenario() with:
- remove_ar_customer: Customer to remove from AR inflows
- fx_change_pct: FX rate change (negative = weakening)
- fx_currency_pair: Which pair is affected (e.g. "EUR/USD")
- additional_outflow: Any extra outflows to model

Present results as a comparison table:
- Show base case vs scenario for each currency
- Show USD equivalent totals
- Calculate and highlight the delta
- Identify cascading risks (e.g. if a deposit becomes problematic)
- Suggest contingency actions

Use clear formatting with aligned columns for easy comparison.""",
    tools=[
        simulate_scenario,
        get_forecast,
        get_ar_open_items,
        get_ap_open_items,
        get_cash_position,
        get_fx_rates,
        convert_currency,
    ],
    output_key="scenario_results",
)
