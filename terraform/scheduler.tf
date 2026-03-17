# Daily data refresh at 2 AM UTC
resource "google_cloud_scheduler_job" "refresh_data" {
  name      = "cash-agent-refresh-data"
  region    = var.region
  schedule  = "0 2 * * *"
  time_zone = "UTC"

  http_target {
    uri         = "${google_cloud_run_v2_service.agent_runner.uri}/run/refresh-data"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.cash_agent_sa.email
    }
  }

  attempt_deadline = "540s"

  depends_on = [google_project_service.cloudscheduler]
}

# Daily review every 4 hours during business hours
resource "google_cloud_scheduler_job" "daily_review" {
  name      = "cash-agent-daily-review"
  region    = var.region
  schedule  = "0 6,10,14,18 * * *"
  time_zone = "UTC"

  http_target {
    uri         = "${google_cloud_run_v2_service.agent_runner.uri}/run/daily-review"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.cash_agent_sa.email
    }
  }

  attempt_deadline = "540s"

  depends_on = [google_project_service.cloudscheduler]
}

# Anomaly scan every 2 hours
resource "google_cloud_scheduler_job" "anomaly_scan" {
  name      = "cash-agent-anomaly-scan"
  region    = var.region
  schedule  = "0 */2 * * *"
  time_zone = "UTC"

  http_target {
    uri         = "${google_cloud_run_v2_service.agent_runner.uri}/run/anomaly-scan"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.cash_agent_sa.email
    }
  }

  attempt_deadline = "540s"

  depends_on = [google_project_service.cloudscheduler]
}
