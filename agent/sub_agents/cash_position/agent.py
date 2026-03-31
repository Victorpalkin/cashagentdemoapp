from google.adk.agents import Agent

from ...shared_libraries.constants import FLASH_MODEL
from ...tools.bigquery_tools import get_cash_position, get_bank_balances
from ...tools.fx_tools import convert_currency

cash_position_agent = Agent(
    name="CashPositionAgent",
    model=FLASH_MODEL,
    description="Returns current cash position across all bank accounts and currencies.",
    instruction="""You report the current cash position for the company.

Steps:
1. Call get_cash_position() to get individual bank account balances.
2. Call get_bank_balances() to get currency totals and grand total.
3. If needed, use convert_currency() to show USD equivalents.

Present results as a clear summary:
- Group by currency (USD, EUR, GBP)
- Show each bank account with name, type, and balance
- Show subtotals per currency with USD equivalent
- Show grand total in USD

Use currency symbols ($, EUR, GBP) and format numbers with commas.

When showing the position summary, include a bar chart of balances by currency:
```chart
{"type": "bar", "title": "Cash Position by Currency (USD Equivalent)", "data": [{"currency": "USD", "balance": ...}, ...], "config": {"xKey": "currency", "yKeys": ["balance"], "colors": {"balance": "#0070F2"}}}
```""",
    tools=[get_cash_position, get_bank_balances, convert_currency],
    output_key="current_position",
)
