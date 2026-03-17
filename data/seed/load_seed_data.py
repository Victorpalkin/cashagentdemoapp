"""Loads seed CSV data into BigQuery and creates the BQML forecast model."""

import json
import os
import sys

from google.cloud import bigquery

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
SCHEMA_FILE = os.path.join(PROJECT_DIR, "data", "bigquery_schemas", "schemas.json")

PROJECT_ID = os.environ.get("PROJECT_ID", "your-gcp-project-id")
DATASET_ID = os.environ.get("DATASET_ID", "cash_agent_demo")
LOCATION = os.environ.get("REGION", "us-central1")


def load_schemas() -> dict:
    with open(SCHEMA_FILE) as f:
        return json.load(f)


def create_dataset(client: bigquery.Client):
    dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = LOCATION
    try:
        client.create_dataset(dataset, exists_ok=True)
        print(f"Dataset {dataset_ref} ready.")
    except Exception as e:
        print(f"Error creating dataset: {e}")
        sys.exit(1)


def load_table(client: bigquery.Client, table_name: str, schema_fields: list):
    csv_path = os.path.join(SCRIPT_DIR, f"{table_name}.csv")
    if not os.path.exists(csv_path):
        print(f"  Skipping {table_name}: CSV not found at {csv_path}")
        return

    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"

    bq_schema = []
    for field in schema_fields:
        bq_schema.append(
            bigquery.SchemaField(
                field["name"],
                field["type"],
                mode=field.get("mode", "NULLABLE"),
            )
        )

    job_config = bigquery.LoadJobConfig(
        schema=bq_schema,
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    with open(csv_path, "rb") as f:
        job = client.load_table_from_file(f, table_ref, job_config=job_config)

    job.result()
    table = client.get_table(table_ref)
    print(f"  {table_name}: loaded {table.num_rows} rows")


def create_empty_tables(client: bigquery.Client, schemas: dict):
    """Create tables that don't have CSV data (approval_requests, agent_audit_log)."""
    for table_name in ["approval_requests", "agent_audit_log"]:
        if table_name not in schemas["tables"]:
            continue
        table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
        bq_schema = []
        for field in schemas["tables"][table_name]["schema"]:
            bq_schema.append(
                bigquery.SchemaField(
                    field["name"],
                    field["type"],
                    mode=field.get("mode", "NULLABLE"),
                )
            )
        table = bigquery.Table(table_ref, schema=bq_schema)
        try:
            client.create_table(table, exists_ok=True)
            print(f"  {table_name}: table ready")
        except Exception as e:
            print(f"  {table_name}: error - {e}")


def create_forecast_model(client: bigquery.Client, schemas: dict):
    ml_config = schemas.get("ml_model", {})
    if not ml_config:
        print("  No ML model configuration found.")
        return

    sql = ml_config["create_sql"].format(project=PROJECT_ID, dataset=DATASET_ID)
    print(f"  Creating BQML model {ml_config['name']}...")
    print(f"  This may take a few minutes...")

    try:
        job = client.query(sql)
        job.result()
        print(f"  Model {ml_config['name']} created successfully.")
    except Exception as e:
        print(f"  Model creation error: {e}")
        print("  You can create the model manually using the notebook.")


def main():
    print(f"Loading seed data into {PROJECT_ID}.{DATASET_ID}")
    print(f"Location: {LOCATION}")
    print()

    client = bigquery.Client(project=PROJECT_ID)
    schemas = load_schemas()

    print("1. Creating dataset...")
    create_dataset(client)

    csv_tables = [
        "gl_accounts",
        "bank_accounts",
        "ap_open_items",
        "ar_open_items",
        "cash_journal",
        "fx_rates",
        "payment_runs",
    ]

    print("\n2. Loading CSV data...")
    for table_name in csv_tables:
        if table_name in schemas["tables"]:
            load_table(client, table_name, schemas["tables"][table_name]["schema"])

    print("\n3. Creating empty tables...")
    create_empty_tables(client, schemas)

    print("\n4. Creating BQML forecast model...")
    create_forecast_model(client, schemas)

    print("\nDone! All seed data loaded.")


if __name__ == "__main__":
    main()
