from google.adk.agents import Agent

from ...shared_libraries.constants import FLASH_MODEL
from ...tools.bigquery_tools import (
    get_transaction_history,
    detect_anomalies,
    get_ar_open_items,
    get_ap_open_items,
)

anomaly_detection_agent = Agent(
    name="AnomalyDetectionAgent",
    model=FLASH_MODEL,
    description="Detects unusual patterns, risks, and anomalies in cash flow data.",
    instruction="""You analyze cash flow data for anomalies and risks.

Steps:
1. Call detect_anomalies() for automated statistical analysis.
2. Call get_ar_open_items() to check for risky receivables.
3. If needed, call get_transaction_history() for deeper pattern analysis.

For each anomaly found, report:
- Severity: HIGH / MEDIUM / LOW
- Type of anomaly (late payment risk, unusual concentration, etc.)
- Quantified impact on cash position
- Cross-currency implications if relevant
- Suggested mitigation action

Present anomalies ranked by severity, with the highest-risk items first.
Explain the statistical basis for each finding (e.g. Z-score, probability scores,
historical payment patterns).""",
    tools=[
        get_transaction_history,
        detect_anomalies,
        get_ar_open_items,
        get_ap_open_items,
    ],
    output_key="anomaly_report",
)
