# SAP API Mock Service
resource "google_cloud_run_v2_service" "sap_api_mock" {
  name     = "sap-api-mock"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/sap-api-mock"

      ports {
        container_port = 8080
      }
    }
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Bank API Mock Service
resource "google_cloud_run_v2_service" "bank_api_mock" {
  name     = "bank-api-mock"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/bank-api-mock"

      ports {
        container_port = 8080
      }
    }
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Broker API Mock Service
resource "google_cloud_run_v2_service" "broker_api_mock" {
  name     = "broker-api-mock"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/broker-api-mock"

      ports {
        container_port = 8080
      }
    }
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# UI API Service (BigQuery backend for management UI)
resource "google_cloud_run_v2_service" "ui_api" {
  name     = "ui-api"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/ui-api"

      ports {
        container_port = 8080
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "DATASET_ID"
        value = var.dataset_id
      }
    }

    service_account = google_service_account.cash_agent_sa.email
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Cash Agent UI Service
resource "google_cloud_run_v2_service" "cash_agent_ui" {
  name     = "cash-agent-ui"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/cash-agent-ui"

      ports {
        container_port = 8080
      }
    }
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Chat App Service
resource "google_cloud_run_v2_service" "chat_app" {
  name     = "chat-app"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/chat-app"

      ports {
        container_port = 8080
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "DATASET_ID"
        value = var.dataset_id
      }

      env {
        name  = "REGION"
        value = var.region
      }

      env {
        name  = "AGENT_ENGINE_ID"
        value = var.agent_engine_id
      }
    }

    service_account = google_service_account.chat_app_sa.email
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Agent Runner Service (autonomous scheduled operations)
resource "google_cloud_run_v2_service" "agent_runner" {
  name     = "agent-runner"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/cash-agent-demo/agent-runner"

      ports {
        container_port = 8080
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "DATASET_ID"
        value = var.dataset_id
      }

      env {
        name  = "REGION"
        value = var.region
      }
    }

    service_account = google_service_account.cash_agent_sa.email

    timeout = "540s"
  }

  depends_on = [google_project_service.run, google_artifact_registry_repository.docker]
}

# Allow unauthenticated access to all services (adjust as needed for production)
resource "google_cloud_run_v2_service_iam_member" "sap_api_mock_public" {
  name     = google_cloud_run_v2_service.sap_api_mock.name
  location = google_cloud_run_v2_service.sap_api_mock.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "bank_api_mock_public" {
  name     = google_cloud_run_v2_service.bank_api_mock.name
  location = google_cloud_run_v2_service.bank_api_mock.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "broker_api_mock_public" {
  name     = google_cloud_run_v2_service.broker_api_mock.name
  location = google_cloud_run_v2_service.broker_api_mock.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "ui_api_public" {
  name     = google_cloud_run_v2_service.ui_api.name
  location = google_cloud_run_v2_service.ui_api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "cash_agent_ui_public" {
  name     = google_cloud_run_v2_service.cash_agent_ui.name
  location = google_cloud_run_v2_service.cash_agent_ui.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "chat_app_public" {
  name     = google_cloud_run_v2_service.chat_app.name
  location = google_cloud_run_v2_service.chat_app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "agent_runner_public" {
  name     = google_cloud_run_v2_service.agent_runner.name
  location = google_cloud_run_v2_service.agent_runner.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
