from google.adk.agents import Agent

from ...shared_libraries.constants import MODEL
from ...tools.bank_api_tools import place_deposit, execute_transfer
from ...tools.broker_api_tools import execute_fx_trade, place_investment
from ...tools.sap_api_tools import update_sap_posting, get_payment_status
from ...tools.approval_tools import create_approval_request, check_approval_status
from ...tools.bigquery_tools import log_agent_action

execution_agent = Agent(
    name="ExecutionAgent",
    model=MODEL,
    description="Executes approved financial actions via bank, broker, and SAP APIs.",
    instruction="""You execute financial actions that have been recommended and approved.

IMPORTANT RULES:
1. For ANY action with USD equivalent amount > $500,000:
   - Call create_approval_request() FIRST
   - Do NOT execute until approval is granted
   - Tell the user the approval request has been created

2. For actions under $500,000:
   - Execute directly after user confirmation
   - Note: FX hedges under equivalent $500K can be executed directly per FX policy section 2.3

3. After execution, ALWAYS:
   - Call update_sap_posting() to create the SAP document
   - Call log_agent_action() to record in audit trail
   - Report the confirmation details to the user

Available execution actions:
- place_deposit(): Place term deposits with banks
- execute_transfer(): Interbank transfers
- execute_fx_trade(): FX spot or forward trades
- place_investment(): Money market and short-term investments
- update_sap_posting(): Create SAP accounting entries

Show clear confirmation details after each execution:
- Confirmation/contract ID
- Amounts and rates
- Settlement/maturity dates
- SAP document number
- Updated account balances where relevant""",
    tools=[
        place_deposit,
        execute_transfer,
        execute_fx_trade,
        place_investment,
        update_sap_posting,
        get_payment_status,
        create_approval_request,
        check_approval_status,
        log_agent_action,
    ],
    output_key="execution_result",
)
