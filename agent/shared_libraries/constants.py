import os

PROJECT_ID = os.environ.get("PROJECT_ID", "your-gcp-project-id")
REGION = os.environ.get("REGION", "us-central1")
DATASET_ID = os.environ.get("DATASET_ID", "cash_agent_demo")
MODEL = os.environ.get("MODEL", "gemini-2.5-pro")
FLASH_MODEL = os.environ.get("FLASH_MODEL", "gemini-2.5-flash")

SAP_API_URL = os.environ.get("SAP_API_URL", "http://localhost:8081")
BANK_API_URL = os.environ.get("BANK_API_URL", "http://localhost:8082")
BROKER_API_URL = os.environ.get("BROKER_API_URL", "http://localhost:8083")

STAGING_BUCKET = os.environ.get("STAGING_BUCKET", "gs://your-staging-bucket")
