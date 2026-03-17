"""Tests for agent tool functions."""

import os
import unittest
from unittest.mock import patch, MagicMock

os.environ["PROJECT_ID"] = "test-project"
os.environ["DATASET_ID"] = "cash_agent_demo"


class TestBigQueryTools(unittest.TestCase):
    @patch("agent.tools.bigquery_tools.bigquery.Client")
    def test_get_cash_position(self, mock_client_cls):
        from agent.tools.bigquery_tools import get_cash_position

        mock_row = {
            "bank_account_id": "BA001",
            "bank_name": "Chase",
            "account_type": "checking",
            "currency": "USD",
            "current_balance": 5200000.0,
            "last_updated": "2026-03-16",
            "usd_rate": None,
        }
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.query.return_value.result.return_value = [mock_row]

        result = get_cash_position("1000")
        self.assertIn("balances", result)
        self.assertEqual(len(result["balances"]), 1)
        self.assertEqual(result["balances"][0]["bank_name"], "Chase")
        self.assertEqual(result["balances"][0]["usd_equivalent"], 5200000.0)

    @patch("agent.tools.bigquery_tools.bigquery.Client")
    def test_get_bank_balances(self, mock_client_cls):
        from agent.tools.bigquery_tools import get_bank_balances

        mock_rows = [
            {"currency": "EUR", "total_balance": 6800000.0, "usd_rate": 1.08},
            {"currency": "GBP", "total_balance": 3100000.0, "usd_rate": 1.27},
            {"currency": "USD", "total_balance": 11100000.0, "usd_rate": None},
        ]
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.query.return_value.result.return_value = mock_rows

        result = get_bank_balances()
        self.assertIn("grand_total_usd", result)
        self.assertGreater(result["grand_total_usd"], 0)

    @patch("agent.tools.bigquery_tools.bigquery.Client")
    def test_detect_anomalies(self, mock_client_cls):
        from agent.tools.bigquery_tools import detect_anomalies

        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        # Mock risky AR query
        risky_ar = [
            {
                "customer_name": "ACME Corp",
                "amount": 2300000,
                "currency": "EUR",
                "due_date": "2026-03-17",
                "probability": 0.45,
            }
        ]
        # Return different results for each query call
        mock_client.query.return_value.result.side_effect = [
            risky_ar,  # risky AR query
            [],  # AP concentration query
            [],  # late payers query
        ]

        result = detect_anomalies()
        self.assertIn("anomalies", result)
        self.assertGreater(result["count"], 0)
        self.assertEqual(result["anomalies"][0]["severity"], "HIGH")


class TestFxTools(unittest.TestCase):
    @patch("agent.tools.fx_tools.bigquery.Client")
    def test_convert_currency_same(self, mock_client_cls):
        from agent.tools.fx_tools import convert_currency

        result = convert_currency(1000, "USD", "USD")
        self.assertEqual(result["converted_amount"], 1000)
        self.assertEqual(result["rate"], 1.0)

    @patch("agent.tools.fx_tools.bigquery.Client")
    def test_convert_currency(self, mock_client_cls):
        from agent.tools.fx_tools import convert_currency

        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.query.return_value.result.return_value = [
            {"exchange_rate": 1.08}
        ]

        result = convert_currency(1000, "EUR", "USD")
        self.assertEqual(result["converted_amount"], 1080.0)
        self.assertEqual(result["rate"], 1.08)


class TestBankApiTools(unittest.TestCase):
    def test_mock_deposit(self):
        from agent.tools.bank_api_tools import place_deposit

        result = place_deposit("Deutsche Bank", "EUR", 3000000, 30, 3.8)
        self.assertEqual(result["status"], "confirmed")
        self.assertEqual(result["amount"], 3000000)
        self.assertIn("confirmation_id", result)

    def test_mock_transfer(self):
        from agent.tools.bank_api_tools import execute_transfer

        result = execute_transfer("Chase", "Bank of America", "USD", 500000)
        self.assertEqual(result["status"], "confirmed")
        self.assertIn("confirmation_id", result)


class TestBrokerApiTools(unittest.TestCase):
    def test_mock_fx_trade(self):
        from agent.tools.broker_api_tools import execute_fx_trade

        result = execute_fx_trade("GBP", "USD", 800000, "forward", 21)
        self.assertEqual(result["status"], "confirmed")
        self.assertEqual(result["buy_currency"], "GBP")
        self.assertEqual(result["buy_amount"], 800000)
        self.assertIn("rate", result)


class TestSapApiTools(unittest.TestCase):
    def test_mock_posting(self):
        from agent.tools.sap_api_tools import update_sap_posting

        result = update_sap_posting("DEPOSIT", 3000000, "EUR", description="Test deposit")
        self.assertEqual(result["status"], "posted")
        self.assertIn("document_number", result)


class TestPolicyTools(unittest.TestCase):
    def test_search_policies(self):
        from agent.tools.policy_tools import search_policies

        result = search_policies("surplus investment limits")
        self.assertIn("results", result)
        # Should find matches in treasury_policy.md
        if result["results"]:
            self.assertIn("source", result["results"][0])


if __name__ == "__main__":
    unittest.main()
