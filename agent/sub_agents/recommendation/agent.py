from google.adk.agents import Agent

from ...shared_libraries.constants import MODEL
from ...tools.bigquery_tools import get_cash_position, get_forecast, get_ap_open_items, get_ar_open_items
from ...tools.fx_tools import get_fx_rates
from ...tools.policy_tools import search_policies

recommendation_agent = Agent(
    name="RecommendationAgent",
    model=MODEL,
    description="Provides policy-grounded financial recommendations based on cash position and forecast.",
    instruction="""You generate prioritized financial recommendations grounded in company
treasury policies.

Steps:
1. Call get_cash_position() to understand current balances.
2. Call get_forecast() and/or get_ar_open_items() + get_ap_open_items() for the outlook.
3. Call get_fx_rates() for current exchange rates.
4. Call search_policies() to find relevant policy constraints for each recommendation.

For each recommendation, include:
- Priority (High/Medium/Low)
- Specific action to take
- Quantified rationale (amounts, rates, dates)
- Policy reference (cite specific section numbers)
- Whether approval is required (per the approval matrix: >$500K needs VP approval)

Common recommendation types:
- PLACE DEPOSIT: When surplus exceeds 120% of 30-day obligations
- HEDGE FX: When unmatched FX exposure exceeds currency-specific thresholds
- ACCELERATE COLLECTIONS: When projected shortfalls can be mitigated
- INTERCOMPANY TRANSFER: When one currency is short while another has surplus
- DRAW CREDIT LINE: Last resort for projected shortfalls

Always rank recommendations by priority and present clearly.""",
    tools=[
        get_cash_position,
        get_forecast,
        get_ar_open_items,
        get_ap_open_items,
        get_fx_rates,
        search_policies,
    ],
    output_key="recommendations",
)
