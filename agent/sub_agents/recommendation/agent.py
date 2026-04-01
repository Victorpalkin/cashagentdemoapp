from google.adk.agents import Agent

from ...shared_libraries.constants import MODEL
from ...tools.bigquery_tools import get_cash_position, get_forecast, get_ap_open_items, get_ar_open_items, get_enriched_forecast
from ...tools.fx_tools import get_fx_rates
from ...tools.policy_tools import search_policies, get_policy_thresholds

recommendation_agent = Agent(
    name="RecommendationAgent",
    model=MODEL,
    description="Provides policy-grounded financial recommendations based on cash position and forecast.",
    instruction="""You generate prioritized financial recommendations grounded in company
treasury policies, using the delta between ML-only and agent-enriched forecasts.

Steps:
1. Call get_policy_thresholds() to get current policy thresholds (surplus ratio,
   hedging limits per currency, approval matrix, collection risk probability).
   Use these values — do NOT assume or hardcode any thresholds.
2. Call get_enriched_forecast() to get the ML-only vs agent-enriched comparison.
   This is your primary data source — it shows where agent intelligence reveals
   risks and opportunities the ML model alone cannot see.
3. Call get_cash_position() to understand current balances.
4. Call get_fx_rates() for current exchange rates.
5. Call search_policies() to find relevant policy constraints for each recommendation.

IMPORTANT: Ground each recommendation in the enriched forecast delta. For example:
- "The ML model predicts adequate EUR cash flow, but when adjusted for ACME Corp's
  45% collection probability, we face a EUR 1.2M shortfall in week 2"
- "The enriched forecast shows USD outflows exceed ML predictions by $X in week 3
  due to scheduled payment runs the statistical model doesn't capture"

For each recommendation, include:
- Priority (High/Medium/Low)
- Specific action to take
- Quantified rationale citing the ML vs enriched delta (amounts, rates, dates)
- Policy reference (cite specific section numbers)
- Whether approval is required (per the approval matrix thresholds from get_policy_thresholds)

Common recommendation types:
- PLACE DEPOSIT: When surplus exceeds the surplus_ratio threshold of obligations
- HEDGE FX: When unmatched FX exposure exceeds the per-currency hedge_thresholds
- ACCELERATE COLLECTIONS: When projected shortfalls can be mitigated
- INTERCOMPANY TRANSFER: When one currency is short while another has surplus
- DRAW CREDIT LINE: Last resort for projected shortfalls

Always rank recommendations by priority and present clearly.""",
    tools=[
        get_enriched_forecast,
        get_cash_position,
        get_forecast,
        get_ar_open_items,
        get_ap_open_items,
        get_fx_rates,
        search_policies,
        get_policy_thresholds,
    ],
    output_key="recommendations",
)
