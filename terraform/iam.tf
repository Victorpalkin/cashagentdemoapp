# Service Account for Cash Agent
resource "google_service_account" "cash_agent_sa" {
  account_id   = "cash-agent-sa"
  display_name = "Cash Agent Service Account"
  description  = "Service account for Cash Agent operations"
}

# Service Account for Chat App
resource "google_service_account" "chat_app_sa" {
  account_id   = "chat-app-sa"
  display_name = "Chat App Service Account"
  description  = "Service account for Chat App with Vertex AI access"
}

# Grant BigQuery Data Editor role to Cash Agent SA
resource "google_project_iam_member" "cash_agent_bigquery_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}

# Grant BigQuery Job User role to Cash Agent SA
resource "google_project_iam_member" "cash_agent_bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}

# Grant Storage Object Viewer role to Cash Agent SA
resource "google_project_iam_member" "cash_agent_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}

# Grant Cloud Run Invoker role to Cash Agent SA
resource "google_project_iam_member" "cash_agent_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.cash_agent_sa.email}"
}

# Grant Vertex AI User role to Chat App SA
resource "google_project_iam_member" "chat_app_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.chat_app_sa.email}"
}

# Grant Cloud Run Invoker role to Chat App SA
resource "google_project_iam_member" "chat_app_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.chat_app_sa.email}"
}
