# GCS Bucket for Policy Documents
resource "google_storage_bucket" "cash_agent_policies" {
  name          = "${var.project_id}-cash-agent-policies"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}

# Upload policy documents to GCS
resource "google_storage_bucket_object" "treasury_policy" {
  name   = "policies/treasury_policy.md"
  bucket = google_storage_bucket.cash_agent_policies.name
  source = "${path.module}/../data/policies/treasury_policy.md"
}

resource "google_storage_bucket_object" "fx_hedging_policy" {
  name   = "policies/fx_hedging_policy.md"
  bucket = google_storage_bucket.cash_agent_policies.name
  source = "${path.module}/../data/policies/fx_hedging_policy.md"
}

resource "google_storage_bucket_object" "approval_matrix" {
  name   = "policies/approval_matrix.md"
  bucket = google_storage_bucket.cash_agent_policies.name
  source = "${path.module}/../data/policies/approval_matrix.md"
}
