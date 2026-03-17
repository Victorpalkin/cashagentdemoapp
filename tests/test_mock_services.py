"""Tests for mock Cloud Run services."""

import unittest
from fastapi.testclient import TestClient


class TestSapApiMock(unittest.TestCase):
    def setUp(self):
        from mock_services.sap_api.main import app
        self.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "healthy")

    def test_create_posting(self):
        resp = self.client.post("/postings", json={
            "document_type": "DEPOSIT",
            "amount": 3000000,
            "currency": "EUR",
            "description": "Term deposit",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "posted")
        self.assertIn("document_number", data)

    def test_get_payment_status(self):
        resp = self.client.get("/payments/PR-001")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "COMPLETED")


class TestBankApiMock(unittest.TestCase):
    def setUp(self):
        from mock_services.bank_api.main import app
        self.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)

    def test_place_deposit(self):
        resp = self.client.post("/deposits", json={
            "bank_name": "Deutsche Bank",
            "currency": "EUR",
            "amount": 3000000,
            "term_days": 30,
            "rate_pct": 3.8,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "confirmed")
        self.assertIn("maturity_date", data)

    def test_execute_transfer(self):
        resp = self.client.post("/transfers", json={
            "from_bank": "Chase",
            "to_bank": "Bank of America",
            "currency": "USD",
            "amount": 500000,
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "confirmed")


class TestBrokerApiMock(unittest.TestCase):
    def setUp(self):
        from mock_services.broker_api.main import app
        self.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)

    def test_fx_trade(self):
        resp = self.client.post("/fx-trades", json={
            "buy_currency": "GBP",
            "sell_currency": "USD",
            "buy_amount": 800000,
            "trade_type": "forward",
            "settlement_days": 21,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "confirmed")
        self.assertEqual(data["buy_currency"], "GBP")
        self.assertIn("rate", data)

    def test_investment(self):
        resp = self.client.post("/investments", json={
            "instrument_type": "term_deposit",
            "currency": "EUR",
            "amount": 3000000,
            "term_days": 30,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "confirmed")


if __name__ == "__main__":
    unittest.main()
