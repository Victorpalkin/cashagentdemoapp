"""Mock broker API tools for FX trades and investments."""

import requests

from ..shared_libraries.constants import BROKER_API_URL


def execute_fx_trade(
    buy_currency: str,
    sell_currency: str,
    buy_amount: float,
    trade_type: str = "forward",
    settlement_days: int = 21,
) -> dict:
    """Executes an FX trade (spot or forward).

    Args:
        buy_currency: Currency to buy (e.g. "GBP").
        sell_currency: Currency to sell (e.g. "USD").
        buy_amount: Amount of buy_currency to purchase.
        trade_type: "spot" or "forward" (default "forward").
        settlement_days: Days until settlement for forwards (default 21).

    Returns:
        dict with trade confirmation including rate and settlement details.
    """
    try:
        resp = requests.post(
            f"{BROKER_API_URL}/fx-trades",
            json={
                "buy_currency": buy_currency,
                "sell_currency": sell_currency,
                "buy_amount": buy_amount,
                "trade_type": trade_type,
                "settlement_days": settlement_days,
            },
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return _mock_fx_trade(
            buy_currency, sell_currency, buy_amount, trade_type, settlement_days
        )


def place_investment(
    instrument_type: str,
    currency: str,
    amount: float,
    term_days: int = 30,
) -> dict:
    """Places a short-term investment (money market, T-bills, etc.).

    Args:
        instrument_type: Type of instrument (e.g. "money_market", "t_bill", "commercial_paper").
        currency: Currency code.
        amount: Investment amount.
        term_days: Investment term in days (default 30).

    Returns:
        dict with investment confirmation.
    """
    try:
        resp = requests.post(
            f"{BROKER_API_URL}/investments",
            json={
                "instrument_type": instrument_type,
                "currency": currency,
                "amount": amount,
                "term_days": term_days,
            },
            timeout=10,
        )
        return resp.json()
    except requests.ConnectionError:
        return _mock_investment(instrument_type, currency, amount, term_days)


def _mock_fx_trade(buy_currency, sell_currency, buy_amount, trade_type, settlement_days):
    import datetime

    # Approximate rates
    rates = {
        ("GBP", "USD"): 1.27,
        ("EUR", "USD"): 1.08,
        ("EUR", "GBP"): 0.8504,
        ("JPY", "USD"): 0.0067,
        ("CHF", "USD"): 1.12,
        ("SGD", "USD"): 0.75,
        ("AUD", "USD"): 0.66,
    }
    pair = (buy_currency, sell_currency)
    rev_pair = (sell_currency, buy_currency)

    if pair in rates:
        rate = rates[pair]
    elif rev_pair in rates:
        rate = 1.0 / rates[rev_pair]
    else:
        rate = 1.0

    # Forward points adjustment
    if trade_type == "forward":
        rate *= 1 - 0.0012 * (settlement_days / 30)

    sell_amount = round(buy_amount * rate, 2)
    today = datetime.date.today()
    settlement = today + datetime.timedelta(days=settlement_days if trade_type == "forward" else 2)

    return {
        "status": "confirmed",
        "contract_id": f"FWD-{today.strftime('%Y-%m%d')}-001",
        "buy_currency": buy_currency,
        "sell_currency": sell_currency,
        "buy_amount": buy_amount,
        "sell_amount": sell_amount,
        "rate": round(rate, 4),
        "trade_type": trade_type,
        "settlement_date": str(settlement),
        "counterparty": "GlobalFX Brokers",
    }


def _mock_investment(instrument_type, currency, amount, term_days):
    import datetime

    rates_by_type = {
        "money_market": 4.2,
        "t_bill": 4.5,
        "commercial_paper": 4.8,
        "term_deposit": 3.8,
    }
    rate = rates_by_type.get(instrument_type, 4.0)
    interest = round(amount * (rate / 100) * (term_days / 365), 2)
    today = datetime.date.today()
    maturity = today + datetime.timedelta(days=term_days)

    return {
        "status": "confirmed",
        "investment_id": f"INV-{today.strftime('%Y-%m%d')}-001",
        "instrument_type": instrument_type,
        "currency": currency,
        "amount": amount,
        "rate_pct": rate,
        "term_days": term_days,
        "maturity_date": str(maturity),
        "expected_return": interest,
    }
