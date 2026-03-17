# Cloud Run Service URLs
output "sap_api_mock_url" {
  description = "URL of the SAP API Mock service"
  value       = google_cloud_run_v2_service.sap_api_mock.uri
}

output "bank_api_mock_url" {
  description = "URL of the Bank API Mock service"
  value       = google_cloud_run_v2_service.bank_api_mock.uri
}

output "broker_api_mock_url" {
  description = "URL of the Broker API Mock service"
  value       = google_cloud_run_v2_service.broker_api_mock.uri
}

output "cash_agent_ui_url" {
  description = "URL of the Cash Agent UI"
  value       = google_cloud_run_v2_service.cash_agent_ui.uri
}

output "chat_app_url" {
  description = "URL of the Chat App service"
  value       = google_cloud_run_v2_service.chat_app.uri
}

# BigQuery Dataset
output "dataset_id" {
  description = "The BigQuery dataset ID"
  value       = google_bigquery_dataset.cash_agent_demo.dataset_id
}

output "dataset_location" {
  description = "The BigQuery dataset location"
  value       = google_bigquery_dataset.cash_agent_demo.location
}

# Service Accounts
output "cash_agent_sa_email" {
  description = "Email of the Cash Agent service account"
  value       = google_service_account.cash_agent_sa.email
}

output "chat_app_sa_email" {
  description = "Email of the Chat App service account"
  value       = google_service_account.chat_app_sa.email
}

# Storage Bucket
output "policy_bucket_name" {
  description = "Name of the GCS bucket for policy documents"
  value       = google_storage_bucket.cash_agent_policies.name
}

# Pub/Sub Topics
output "approval_requests_topic" {
  description = "Name of the approval requests Pub/Sub topic"
  value       = google_pubsub_topic.approval_requests.name
}

output "agent_actions_topic" {
  description = "Name of the agent actions Pub/Sub topic"
  value       = google_pubsub_topic.agent_actions.name
}

# Workflow
output "approval_workflow_id" {
  description = "ID of the approval workflow"
  value       = google_workflows_workflow.approval_workflow.id
}
