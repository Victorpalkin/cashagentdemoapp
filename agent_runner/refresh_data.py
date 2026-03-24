"""Refresh seed data with today's dates and reload into BigQuery."""

import logging
import os
import subprocess
import sys
import tempfile
from datetime import date

from google.cloud import bigquery

logger = logging.getLogger("refresh_data")


def refresh_all_data(project_id: str, dataset_id: str) -> dict:
    """Regenerate seed data with today's dates and reload into BigQuery."""
    today = date.today()
    results = {"today": today.isoformat(), "tables_loaded": 0, "errors": []}

    # Import the generator - try local path first, then container path
    generator_paths = [
        os.path.join(os.path.dirname(__file__), '..', 'data', 'seed'),
        os.path.dirname(__file__),  # In container, it's in /app/
    ]

    gen_module = None
    for path in generator_paths:
        gen_file = os.path.join(path, 'generate_large_csvs.py')
        if os.path.exists(gen_file):
            import importlib.util
            spec = importlib.util.spec_from_file_location("generate_large_csvs", gen_file)
            gen_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(gen_module)
            break

    if gen_module is None:
        return {"error": "Could not find generate_large_csvs.py"}

    # Generate CSVs to a temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        original_output_dir = gen_module.OUTPUT_DIR
        gen_module.OUTPUT_DIR = type(original_output_dir)(tmpdir)

        try:
            # Generate all CSVs with today's date
            gen_module.generate_fx_rates(today)
            gen_module.generate_cash_journal(today)
            gen_module.generate_ar_items(today)
            gen_module.generate_ap_items(today)
            gen_module.generate_bank_accounts(today)
            gen_module.generate_payment_runs(today)
        except Exception as e:
            logger.error(f"CSV generation failed: {e}")
            results["errors"].append(f"Generation: {str(e)}")
            return results

        # Load CSVs into BigQuery
        client = bigquery.Client(project=project_id)

        tables_to_load = [
            "fx_rates", "cash_journal", "ar_open_items",
            "ap_open_items", "bank_accounts", "payment_runs"
        ]

        for table_name in tables_to_load:
            csv_path = os.path.join(tmpdir, f"{table_name}.csv")
            if not os.path.exists(csv_path):
                logger.warning(f"CSV not found: {csv_path}")
                results["errors"].append(f"Missing CSV: {table_name}")
                continue

            table_ref = f"{project_id}.{dataset_id}.{table_name}"

            try:
                job_config = bigquery.LoadJobConfig(
                    source_format=bigquery.SourceFormat.CSV,
                    skip_leading_rows=1,
                    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
                    autodetect=False,
                )

                with open(csv_path, "rb") as f:
                    job = client.load_table_from_file(f, table_ref, job_config=job_config)
                    job.result()  # Wait for completion

                results["tables_loaded"] += 1
                logger.info(f"Loaded {table_name}")
            except Exception as e:
                logger.error(f"Failed to load {table_name}: {e}")
                results["errors"].append(f"Load {table_name}: {str(e)}")

        # Truncate operational tables
        operational_tables = ["approval_requests", "agent_audit_log", "agent_recommendations"]
        for table_name in operational_tables:
            try:
                client.query(f"TRUNCATE TABLE `{project_id}.{dataset_id}.{table_name}`").result()
                logger.info(f"Truncated {table_name}")
            except Exception as e:
                logger.warning(f"Could not truncate {table_name}: {e}")

        # No model training needed — TimesFM via AI.FORECAST is model-free

    return results
