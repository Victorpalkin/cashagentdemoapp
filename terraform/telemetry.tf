# Observability: BQ Agent Analytics dataset + GCS logs bucket for prompt-response logging

resource "google_bigquery_dataset" "agent_analytics" {
  dataset_id    = "cash_agent_analytics"
  friendly_name = "Cash Agent Analytics"
  description   = "BigQuery Agent Analytics — structured agent events (LLM calls, tool use, outcomes)"
  location      = var.region

  depends_on = [google_project_service.bigquery]
}

resource "google_storage_bucket" "agent_logs" {
  name          = "${var.project_id}-cash-agent-logs"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.storage]
}

# Agent Engine SA needs write access to the analytics dataset and logs bucket
resource "google_bigquery_dataset_iam_member" "agent_engine_analytics_editor" {
  dataset_id = google_bigquery_dataset.agent_analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
}

resource "google_storage_bucket_iam_member" "agent_engine_logs_writer" {
  bucket = google_storage_bucket.agent_logs.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
}

# Cash Agent SA also needs access (used by agent_runner Cloud Run service)
resource "google_bigquery_dataset_iam_member" "cash_agent_analytics_editor" {
  dataset_id = google_bigquery_dataset.agent_analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}

resource "google_storage_bucket_iam_member" "cash_agent_logs_writer" {
  bucket = google_storage_bucket.agent_logs.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}
