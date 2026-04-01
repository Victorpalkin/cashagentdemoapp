"""Mock Broker API service."""

import datetime
import random
import string

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock Broker API")

FX_RATES = {
    ("GBP", "USD"): 1.27,
    ("EUR", "USD"): 1.08,
    ("EUR", "GBP"): 0.8504,
    ("USD", "EUR"): 1 / 1.08,
    ("USD", "GBP"): 1 / 1.27,
    ("GBP", "EUR"): 1 / 0.8504,
    ("JPY", "USD"): 0.0067,
    ("CHF", "USD"): 1.12,
    ("SGD", "USD"): 0.75,
    ("AUD", "USD"): 0.66,
    ("USD", "JPY"): 1 / 0.0067,
    ("USD", "CHF"): 1 / 1.12,
    ("USD", "SGD"): 1 / 0.75,
    ("USD", "AUD"): 1 / 0.66,
    ("JPY", "EUR"): 0.0062,
    ("CHF", "EUR"): 1.037,
    ("SGD", "GBP"): 0.59,
    ("AUD", "GBP"): 0.52,
}


class FxTradeRequest(BaseModel):
    buy_currency: str
    sell_currency: str
    buy_amount: float
    trade_type: str = "forward"
    settlement_days: int = 21


class InvestmentRequest(BaseModel):
    instrument_type: str
    currency: str
    amount: float
    term_days: int = 30


def _gen_id(prefix: str) -> str:
    today = datetime.date.today().strftime("%Y-%m%d")
    seq = "".join(random.choices(string.digits, k=3))
    return f"{prefix}-{today}-{seq}"


@app.post("/fx-trades")
def execute_fx_trade(req: FxTradeRequest):
    pair = (req.buy_currency, req.sell_currency)
    rate = FX_RATES.get(pair, 1.0)

    if req.trade_type == "forward":
        rate *= 1 - 0.0012 * (req.settlement_days / 30)

    sell_amount = round(req.buy_amount * rate, 2)
    today = datetime.date.today()
    settlement = today + datetime.timedelta(
        days=req.settlement_days if req.trade_type == "forward" else 2
    )

    return {
        "status": "confirmed",
        "contract_id": _gen_id("FWD" if req.trade_type == "forward" else "SPT"),
        "buy_currency": req.buy_currency,
        "sell_currency": req.sell_currency,
        "buy_amount": req.buy_amount,
        "sell_amount": sell_amount,
        "rate": round(rate, 4),
        "trade_type": req.trade_type,
        "settlement_date": str(settlement),
        "counterparty": "GlobalFX Brokers",
    }


@app.post("/investments")
def place_investment(req: InvestmentRequest):
    rates_by_type = {
        "money_market": 4.2,
        "t_bill": 4.5,
        "commercial_paper": 4.8,
        "term_deposit": 3.8,
    }
    rate = rates_by_type.get(req.instrument_type, 4.0)
    interest = round(req.amount * (rate / 100) * (req.term_days / 365), 2)
    today = datetime.date.today()
    maturity = today + datetime.timedelta(days=req.term_days)

    return {
        "status": "confirmed",
        "investment_id": _gen_id("INV"),
        "instrument_type": req.instrument_type,
        "currency": req.currency,
        "amount": req.amount,
        "rate_pct": rate,
        "term_days": req.term_days,
        "maturity_date": str(maturity),
        "expected_return": interest,
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "broker-api-mock"}
