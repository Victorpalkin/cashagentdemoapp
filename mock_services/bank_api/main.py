"""Mock Bank API service."""

import datetime
import random
import string

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock Bank API")


class DepositRequest(BaseModel):
    bank_name: str
    currency: str
    amount: float
    term_days: int
    rate_pct: float


class TransferRequest(BaseModel):
    from_bank: str
    to_bank: str
    currency: str
    amount: float
    reference: str = ""


def _gen_id(prefix: str) -> str:
    today = datetime.date.today().strftime("%Y-%m%d")
    seq = "".join(random.choices(string.digits, k=3))
    return f"{prefix}-{today}-{seq}"


@app.post("/deposits")
def place_deposit(req: DepositRequest):
    today = datetime.date.today()
    maturity = today + datetime.timedelta(days=req.term_days)
    interest = round(req.amount * (req.rate_pct / 100) * (req.term_days / 365), 2)
    return {
        "status": "confirmed",
        "confirmation_id": _gen_id("DEP"),
        "bank_name": req.bank_name,
        "currency": req.currency,
        "amount": req.amount,
        "term_days": req.term_days,
        "rate_pct": req.rate_pct,
        "maturity_date": str(maturity),
        "expected_interest": interest,
        "value_date": str(today),
    }


@app.post("/transfers")
def execute_transfer(req: TransferRequest):
    today = datetime.date.today()
    return {
        "status": "confirmed",
        "confirmation_id": _gen_id("TRF"),
        "from_bank": req.from_bank,
        "to_bank": req.to_bank,
        "currency": req.currency,
        "amount": req.amount,
        "reference": req.reference,
        "value_date": str(today),
    }


@app.get("/balances/{account_id}")
def get_balance(account_id: str):
    return {
        "account_id": account_id,
        "balance": round(random.uniform(500000, 8000000), 2),
        "currency": "USD",
        "as_of": str(datetime.date.today()),
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "bank-api-mock"}
