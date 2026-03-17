from google.adk.agents import Agent

from ...shared_libraries.constants import FLASH_MODEL
from ...tools.bigquery_tools import (
    get_forecast,
    get_ar_open_items,
    get_ap_open_items,
    get_payment_runs,
)

cash_forecast_agent = Agent(
    name="CashForecastAgent",
    model=FLASH_MODEL,
    description="Forecasts cash flow for the next 30/60/90 days using BQML and AR/AP data.",
    instruction="""You provide cash flow forecasts by combining BQML time-series predictions
with deterministic AR/AP data.

Steps:
1. Call get_forecast() for the BQML ARIMA+ prediction (if available).
2. Call get_ar_open_items() to get expected inflows.
3. Call get_ap_open_items() to get expected outflows.
4. Call get_payment_runs() to see scheduled batch payments.

Present a forecast summary by currency:
- Show expected inflows (AR collections) vs outflows (AP payments + payment runs)
- Highlight any projected shortfalls or surpluses
- Break down by week if the user asks for 30-day forecast
- Flag any weeks where outflows significantly exceed inflows

If the BQML model is not available, base the forecast on AR/AP data alone
and note that statistical forecasting is unavailable.""",
    tools=[get_forecast, get_ar_open_items, get_ap_open_items, get_payment_runs],
    output_key="cash_forecast",
)
