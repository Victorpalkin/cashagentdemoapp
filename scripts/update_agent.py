#!/usr/bin/env python3
"""Update the deployed Agent Engine with the latest agent code.

Usage:
    python scripts/update_agent.py

Requires:
    - gcloud auth application-default login
    - .venv with google-cloud-aiplatform installed
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PROJECT_ID = os.environ.get("PROJECT_ID", "cash-agent-demo")
REGION = os.environ.get("REGION", "us-central1")
AGENT_ENGINE_ID = os.environ.get("AGENT_ENGINE_ID", "1392070231450451968")
STAGING_BUCKET = f"gs://{PROJECT_ID}-cash-agent-staging"

# Env vars passed to the Agent Engine runtime.
# GOOGLE_CLOUD_LOCATION=global is REQUIRED for Gemini 3 preview models.
AGENT_ENV_VARS = {
    "GOOGLE_CLOUD_LOCATION": "global",
    "PROJECT_ID": PROJECT_ID,
}

REQUIREMENTS = [
    "google-cloud-aiplatform[adk,agent_engines]",
    "google-cloud-bigquery",
    "google-cloud-storage",
    "requests",
]


def main():
    import vertexai
    from vertexai import agent_engines

    vertexai.init(project=PROJECT_ID, location=REGION, staging_bucket=STAGING_BUCKET)

    from agent.agent import root_agent

    resource_name = (
        f"projects/{PROJECT_ID}/locations/{REGION}"
        f"/reasoningEngines/{AGENT_ENGINE_ID}"
    )

    print(f"Updating Agent Engine {AGENT_ENGINE_ID}...")
    print(f"  env_vars: {AGENT_ENV_VARS}")

    agent_engines.update(
        resource_name=resource_name,
        agent_engine=root_agent,
        requirements=REQUIREMENTS,
        env_vars=AGENT_ENV_VARS,
        display_name="Cash Agent Demo",
        description="AI-powered Treasury Cash Agent",
    )

    print("Agent Engine updated successfully.")


if __name__ == "__main__":
    main()
