"""Approval workflow tools for human-in-the-loop decisions."""

from google.cloud import bigquery

from ..shared_libraries.constants import PROJECT_ID, DATASET_ID


def create_approval_request(
    action_type: str,
    amount: float,
    currency: str,
    description: str,
    agent_reasoning: str,
) -> dict:
    """Creates a new approval request for actions exceeding thresholds.

    Args:
        action_type: Type of action (e.g. "TERM_DEPOSIT", "FX_TRADE", "TRANSFER").
        amount: Transaction amount.
        currency: Currency code.
        description: Human-readable description of the proposed action.
        agent_reasoning: The agent's rationale for this recommendation.

    Returns:
        dict with approval request ID and status.
    """
    client = bigquery.Client(project=PROJECT_ID)
    import datetime
    import random

    request_id = f"APR-2026-{random.randint(1000, 9999):04d}"

    table_ref = f"{PROJECT_ID}.{DATASET_ID}.approval_requests"
    query = f"""
        INSERT INTO `{table_ref}`
        (request_id, action_type, amount, currency, description, agent_reasoning, status, requested_at, requested_by)
        VALUES
        (@request_id, @action_type, @amount, @currency, @description, @agent_reasoning, 'PENDING', @requested_at, 'cash_agent')
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            bigquery.ScalarQueryParameter("action_type", "STRING", action_type),
            bigquery.ScalarQueryParameter("amount", "FLOAT64", amount),
            bigquery.ScalarQueryParameter("currency", "STRING", currency),
            bigquery.ScalarQueryParameter("description", "STRING", description),
            bigquery.ScalarQueryParameter("agent_reasoning", "STRING", agent_reasoning),
            bigquery.ScalarQueryParameter("requested_at", "STRING", datetime.datetime.now().isoformat()),
        ]
    )
    try:
        client.query(query, job_config=job_config).result()
    except Exception as e:
        return {"status": "error", "errors": str(e)}
    return {
        "status": "pending_approval",
        "request_id": request_id,
        "action_type": action_type,
        "amount": amount,
        "currency": currency,
        "description": description,
        "message": f"Approval request {request_id} created. Awaiting VP-level approval.",
    }


def check_approval_status(request_id: str) -> dict:
    """Checks the status of an approval request.

    Args:
        request_id: The approval request ID (e.g. "APR-2026-0042").

    Returns:
        dict with current approval status and details.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT request_id, action_type, amount, currency, status,
               description, agent_reasoning, requested_at,
               approved_at, approved_by, rejection_reason
        FROM `{PROJECT_ID}.{DATASET_ID}.approval_requests`
        WHERE request_id = @request_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id)
        ]
    )
    rows = list(client.query(query, job_config=job_config).result())
    if not rows:
        return {"error": f"Approval request {request_id} not found."}
    return dict(rows[0])


def get_pending_approvals() -> dict:
    """Returns all pending approval requests.

    Returns:
        dict with list of pending approvals.
    """
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
        SELECT request_id, action_type, amount, currency, status,
               description, agent_reasoning, requested_at
        FROM `{PROJECT_ID}.{DATASET_ID}.approval_requests`
        WHERE status = 'PENDING'
        ORDER BY requested_at DESC
    """
    rows = client.query(query).result()
    items = [dict(row) for row in rows]
    return {"pending_approvals": items, "count": len(items)}


def approve_request(request_id: str, approved_by: str, comment: str = "") -> dict:
    """Approves a pending approval request.

    Args:
        request_id: The approval request ID.
        approved_by: Name or ID of the approver.
        comment: Optional approval comment.

    Returns:
        dict confirming the approval.
    """
    client = bigquery.Client(project=PROJECT_ID)
    import datetime

    query = f"""
        UPDATE `{PROJECT_ID}.{DATASET_ID}.approval_requests`
        SET status = 'APPROVED',
            approved_by = @approved_by,
            approved_at = @approved_at,
            rejection_reason = @comment
        WHERE request_id = @request_id AND status = 'PENDING'
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            bigquery.ScalarQueryParameter("approved_by", "STRING", approved_by),
            bigquery.ScalarQueryParameter("approved_at", "STRING", datetime.datetime.now().isoformat()),
            bigquery.ScalarQueryParameter("comment", "STRING", comment),
        ]
    )
    client.query(query, job_config=job_config).result()
    return {
        "status": "approved",
        "request_id": request_id,
        "approved_by": approved_by,
        "message": f"Request {request_id} has been approved.",
    }


def reject_request(request_id: str, rejected_by: str, reason: str) -> dict:
    """Rejects a pending approval request.

    Args:
        request_id: The approval request ID.
        rejected_by: Name or ID of the rejector.
        reason: Reason for rejection.

    Returns:
        dict confirming the rejection.
    """
    client = bigquery.Client(project=PROJECT_ID)
    import datetime

    query = f"""
        UPDATE `{PROJECT_ID}.{DATASET_ID}.approval_requests`
        SET status = 'REJECTED',
            approved_by = @rejected_by,
            approved_at = @rejected_at,
            rejection_reason = @reason
        WHERE request_id = @request_id AND status = 'PENDING'
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            bigquery.ScalarQueryParameter("rejected_by", "STRING", rejected_by),
            bigquery.ScalarQueryParameter("rejected_at", "STRING", datetime.datetime.now().isoformat()),
            bigquery.ScalarQueryParameter("reason", "STRING", reason),
        ]
    )
    client.query(query, job_config=job_config).result()
    return {
        "status": "rejected",
        "request_id": request_id,
        "rejected_by": rejected_by,
        "reason": reason,
    }
