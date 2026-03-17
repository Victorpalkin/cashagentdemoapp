"""Tests for agent configuration and imports."""

import os
import unittest

os.environ["PROJECT_ID"] = "test-project"
os.environ["DATASET_ID"] = "cash_agent_demo"
os.environ["MODEL"] = "gemini-2.5-pro"
os.environ["FLASH_MODEL"] = "gemini-2.5-flash"


class TestAgentImports(unittest.TestCase):
    def test_root_agent_import(self):
        from agent import root_agent

        self.assertIsNotNone(root_agent)
        self.assertEqual(root_agent.name, "cash_agent")

    def test_root_agent_has_sub_agents(self):
        from agent import root_agent

        self.assertEqual(len(root_agent.sub_agents), 6)
        names = {a.name for a in root_agent.sub_agents}
        self.assertIn("CashPositionAgent", names)
        self.assertIn("CashForecastAgent", names)
        self.assertIn("RecommendationAgent", names)
        self.assertIn("ExecutionAgent", names)
        self.assertIn("AnomalyDetectionAgent", names)
        self.assertIn("ScenarioSimulationAgent", names)

    def test_cash_position_agent(self):
        from agent.sub_agents.cash_position.agent import cash_position_agent

        self.assertEqual(cash_position_agent.name, "CashPositionAgent")
        self.assertIsNotNone(cash_position_agent.tools)
        self.assertGreater(len(cash_position_agent.tools), 0)

    def test_forecast_agent(self):
        from agent.sub_agents.forecasting.agent import cash_forecast_agent

        self.assertEqual(cash_forecast_agent.name, "CashForecastAgent")

    def test_recommendation_agent(self):
        from agent.sub_agents.recommendation.agent import recommendation_agent

        self.assertEqual(recommendation_agent.name, "RecommendationAgent")

    def test_execution_agent(self):
        from agent.sub_agents.execution.agent import execution_agent

        self.assertEqual(execution_agent.name, "ExecutionAgent")

    def test_anomaly_detection_agent(self):
        from agent.sub_agents.anomaly_detection.agent import anomaly_detection_agent

        self.assertEqual(anomaly_detection_agent.name, "AnomalyDetectionAgent")

    def test_scenario_simulation_agent(self):
        from agent.sub_agents.scenario_simulation.agent import scenario_simulation_agent

        self.assertEqual(scenario_simulation_agent.name, "ScenarioSimulationAgent")


if __name__ == "__main__":
    unittest.main()
