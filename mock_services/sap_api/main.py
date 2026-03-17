"""Mock SAP API service."""

import datetime
import random

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock SAP API")


class PostingRequest(BaseModel):
    document_type: str
    amount: float
    currency: str
    gl_account: str = ""
    description: str = ""


class PostingResponse(BaseModel):
    status: str
    document_number: str
    document_type: str
    amount: float
    currency: str
    posting_date: str
    description: str


@app.post("/postings", response_model=PostingResponse)
def create_posting(req: PostingRequest):
    doc_num = f"500001{random.randint(1000, 9999)}"
    return PostingResponse(
        status="posted",
        document_number=doc_num,
        document_type=req.document_type,
        amount=req.amount,
        currency=req.currency,
        posting_date=str(datetime.date.today()),
        description=req.description or f"{req.document_type} posting",
    )


@app.get("/payments/{payment_id}")
def get_payment_status(payment_id: str):
    return {
        "payment_id": payment_id,
        "status": "COMPLETED",
        "completion_date": str(datetime.date.today()),
        "message": "Payment processed successfully",
    }


@app.get("/gl-balances/{gl_account}")
def get_gl_balance(gl_account: str):
    return {
        "gl_account": gl_account,
        "balance": round(random.uniform(100000, 5000000), 2),
        "currency": "USD",
        "as_of": str(datetime.date.today()),
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "sap-api-mock"}
