"""Mock bank API tools for deposits and transfers."""

import requests

from ..shared_libraries.constants import BANK_API_URL


def place_deposit(
    bank_name: str,
    currency: str,
    amount: float,
    term_days: int,
    rate_pct: float,
) -> dict:
    """Places a term deposit with a bank.

    Args:
        bank_name: Name of the bank (e.g. "Deutsche Bank").
        currency: Currency code (e.g. "EUR").
        amount: Deposit amount.
        term_days: Term length in days (e.g. 30, 60, 90).
        rate_pct: Annual interest rate in percent (e.g. 3.8).

    Returns:
        dict with deposit confirmation details.
    """
    try:
        resp = requests.post(
            f"{BANK_API_URL}/deposits",
            json={
                "bank_name": bank_name,
                "currency": currency,
                "amount": amount,
                "term_days": term_days,
                "rate_pct": rate_pct,
            },
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return _mock_deposit(bank_name, currency, amount, term_days, rate_pct)


def execute_transfer(
    from_bank: str,
    to_bank: str,
    currency: str,
    amount: float,
    reference: str = "",
) -> dict:
    """Executes an interbank transfer.

    Args:
        from_bank: Source bank name.
        to_bank: Destination bank name.
        currency: Currency code.
        amount: Transfer amount.
        reference: Optional payment reference.

    Returns:
        dict with transfer confirmation.
    """
    try:
        resp = requests.post(
            f"{BANK_API_URL}/transfers",
            json={
                "from_bank": from_bank,
                "to_bank": to_bank,
                "currency": currency,
                "amount": amount,
                "reference": reference,
            },
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return _mock_transfer(from_bank, to_bank, currency, amount, reference)


def _mock_deposit(bank_name, currency, amount, term_days, rate_pct):
    import datetime
    today = datetime.date.today()
    maturity = today + datetime.timedelta(days=term_days)
    interest = round(amount * (rate_pct / 100) * (term_days / 365), 2)
    return {
        "status": "confirmed",
        "confirmation_id": f"DEP-{today.strftime('%Y-%m%d')}-001",
        "bank_name": bank_name,
        "currency": currency,
        "amount": amount,
        "term_days": term_days,
        "rate_pct": rate_pct,
        "maturity_date": str(maturity),
        "expected_interest": interest,
    }


def _mock_transfer(from_bank, to_bank, currency, amount, reference):
    import datetime
    today = datetime.date.today()
    return {
        "status": "confirmed",
        "confirmation_id": f"TRF-{today.strftime('%Y-%m%d')}-001",
        "from_bank": from_bank,
        "to_bank": to_bank,
        "currency": currency,
        "amount": amount,
        "reference": reference,
        "value_date": str(today),
    }
