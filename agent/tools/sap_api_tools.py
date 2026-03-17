"""Mock SAP API tools for GL postings and payment status."""

import requests

from ..shared_libraries.constants import SAP_API_URL


def update_sap_posting(
    document_type: str,
    amount: float,
    currency: str,
    gl_account: str = "",
    description: str = "",
) -> dict:
    """Creates or updates a posting in SAP (mock).

    Args:
        document_type: Type of SAP document (e.g. "DEPOSIT", "FX_TRADE", "PAYMENT", "TRANSFER").
        amount: Transaction amount.
        currency: Currency code.
        gl_account: GL account number (optional, auto-determined by type if empty).
        description: Posting description.

    Returns:
        dict with SAP document number and posting confirmation.
    """
    try:
        resp = requests.post(
            f"{SAP_API_URL}/postings",
            json={
                "document_type": document_type,
                "amount": amount,
                "currency": currency,
                "gl_account": gl_account,
                "description": description,
            },
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return _mock_posting(document_type, amount, currency, description)


def get_payment_status(payment_id: str) -> dict:
    """Checks the status of a payment in SAP.

    Args:
        payment_id: SAP payment document ID or payment run ID.

    Returns:
        dict with payment status details.
    """
    try:
        resp = requests.get(
            f"{SAP_API_URL}/payments/{payment_id}",
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return {
            "payment_id": payment_id,
            "status": "COMPLETED",
            "message": "Payment processed successfully (mock)",
        }


def _mock_posting(document_type, amount, currency, description):
    import datetime
    import random

    doc_num = f"500001{random.randint(1000, 9999)}"
    return {
        "status": "posted",
        "document_number": doc_num,
        "document_type": document_type,
        "amount": amount,
        "currency": currency,
        "posting_date": str(datetime.date.today()),
        "description": description,
    }
